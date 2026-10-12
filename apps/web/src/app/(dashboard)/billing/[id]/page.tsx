"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { QueryState } from "@/components/shared/query-state";
import { Pagination } from "@/components/shared/pagination";
import {
  getInvoice, recordPayment, applyDiscount, cancelInvoice, reversePayment, PAGE_SIZE,
  type Invoice, type PaymentMethod,
} from "@/lib/api/laboratory";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { use, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const STATUS_COLORS: Record<Invoice["status"], string> = {
  UNPAID: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-900",
  PARTIALLY_PAID: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/50 dark:border-blue-900",
  PAID: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-900",
  CANCELLED: "text-muted-foreground bg-muted border-border",
};

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "UPI", "BANK_TRANSFER"];

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  method: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

const discountSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  reason: z.string().min(1, "Reason is required").max(500),
});

const cancelSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500),
});

type PaymentValues = z.infer<typeof paymentSchema>;
type DiscountValues = z.infer<typeof discountSchema>;
type CancelValues = z.infer<typeof cancelSchema>;

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<"payment" | "discount" | "cancel" | null>(null);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [cancelValues, setCancelValues] = useState<CancelValues | null>(null);
  const [paymentToReverse, setPaymentToReverse] = useState<{ id: string; amount: string } | null>(null);
  const [itemsPage, setItemsPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [adjustmentsPage, setAdjustmentsPage] = useState(1);

  const invoice = useQuery({
    queryKey: ["invoices", id],
    queryFn: () => getInvoice(id),
  });

  const paymentForm = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, method: "CASH" },
  });

  const discountForm = useForm<DiscountValues>({
    resolver: zodResolver(discountSchema),
    defaultValues: { amount: 0, reason: "" },
  });

  const cancelForm = useForm<CancelValues>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { reason: "" },
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["invoices"] });
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const paymentMutation = useMutation({
    mutationFn: (values: PaymentValues) => recordPayment(id, values),
    onSuccess: async () => { await invalidate(); setPanel(null); paymentForm.reset(); },
  });

  const discountMutation = useMutation({
    mutationFn: (values: DiscountValues) => applyDiscount(id, values),
    onSuccess: async () => { await invalidate(); setPanel(null); discountForm.reset(); },
  });

  const cancelMutation = useMutation({
    mutationFn: (values: CancelValues) => cancelInvoice(id, values),
    onSuccess: async () => {
      await invalidate();
      setPanel(null);
      cancelForm.reset();
      setCancelConfirmationOpen(false);
      setCancelValues(null);
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (paymentId: string) => reversePayment(id, paymentId),
    onSuccess: async () => {
      await invalidate();
      setPaymentToReverse(null);
    },
  });

  const inv = invoice.data;
  const balance = inv ? (Number(inv.totalAmount) - Number(inv.paidAmount)).toFixed(2) : "0.00";
  const canAct = inv && inv.status !== "CANCELLED";
  const canPay = canAct && inv.status !== "PAID";

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <ConfirmationDialog
        open={cancelConfirmationOpen}
        onOpenChange={setCancelConfirmationOpen}
        title="Cancel invoice?"
        description={
          cancelMutation.isError
            ? `Cancellation failed: ${cancelMutation.error.message}`
            : "This cannot be undone. All payments must be reversed first."
        }
        confirmLabel="Confirm cancellation"
        onConfirm={() => {
          if (cancelValues) cancelMutation.mutate(cancelValues);
        }}
        isPending={cancelMutation.isPending}
        destructive
      />
      <ConfirmationDialog
        open={paymentToReverse !== null}
        onOpenChange={(open) => {
          if (!open && !reverseMutation.isPending) setPaymentToReverse(null);
        }}
        title="Reverse payment?"
        description={
          reverseMutation.isError
            ? `Payment reversal failed: ${reverseMutation.error.message}`
            : `Reverse the payment of ${paymentToReverse ? formatCurrency(paymentToReverse.amount) : ""}? This will adjust the invoice balance and cannot be undone.`
        }
        confirmLabel="Reverse payment"
        onConfirm={() => {
          if (paymentToReverse) reverseMutation.mutate(paymentToReverse.id);
        }}
        isPending={reverseMutation.isPending}
        destructive
      />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link className="text-sm text-muted-foreground hover:underline" href="/billing">← Billing</Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {inv ? inv.invoiceNumber : "Invoice"}
          </h1>
          {inv && (
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
              {titleCase(inv.status)}
            </span>
          )}
        </div>
        {inv && canAct && (
          <div className="flex flex-wrap gap-2">
            {canPay && (
              <Button onClick={() => setPanel(panel === "payment" ? null : "payment")} size="sm" variant="outline">
                Record payment
              </Button>
            )}
            <Button onClick={() => setPanel(panel === "discount" ? null : "discount")} size="sm" variant="outline">
              Apply discount
            </Button>
            <Button onClick={() => setPanel(panel === "cancel" ? null : "cancel")} size="sm" variant="outline">
              Cancel invoice
            </Button>
          </div>
        )}
      </header>

      <QueryState error={invoice.error} loading={invoice.isPending} onRetry={() => void invoice.refetch()}>
        {inv && (
          <div className="space-y-6">
            {/* Action panels */}
            {panel === "payment" && (
              <section className="rounded-xl border bg-card p-5 space-y-4">
                <h2 className="font-semibold">Record payment</h2>
                <p className="text-sm text-muted-foreground">Balance: <strong>{formatCurrency(balance)}</strong></p>
                {paymentMutation.isError && <p className="text-sm text-destructive" role="alert">{paymentMutation.error.message}</p>}
                <form className="space-y-4" onSubmit={paymentForm.handleSubmit((v) => paymentMutation.mutate(v))}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium" htmlFor="pay-amount">Amount (₹)</label>
                      <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="pay-amount" step="0.01" type="number" {...paymentForm.register("amount")} />
                      {paymentForm.formState.errors.amount && <p className="text-xs text-destructive">{paymentForm.formState.errors.amount.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium" htmlFor="pay-method">Method</label>
                      <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="pay-method" {...paymentForm.register("method")}>
                        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium" htmlFor="pay-ref">Reference number (optional)</label>
                      <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="pay-ref" {...paymentForm.register("referenceNumber")} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium" htmlFor="pay-notes">Notes (optional)</label>
                      <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="pay-notes" {...paymentForm.register("notes")} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button disabled={paymentMutation.isPending} type="submit" size="sm">{paymentMutation.isPending ? "Recording…" : "Record payment"}</Button>
                    <Button onClick={() => setPanel(null)} size="sm" type="button" variant="outline">Cancel</Button>
                  </div>
                </form>
              </section>
            )}

            {panel === "discount" && (
              <section className="rounded-xl border bg-card p-5 space-y-4">
                <h2 className="font-semibold">Apply discount</h2>
                {discountMutation.isError && <p className="text-sm text-destructive" role="alert">{discountMutation.error.message}</p>}
                <form className="space-y-4" onSubmit={discountForm.handleSubmit((v) => discountMutation.mutate(v))}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium" htmlFor="disc-amount">Discount amount (₹)</label>
                      <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="disc-amount" step="0.01" type="number" {...discountForm.register("amount")} />
                      {discountForm.formState.errors.amount && <p className="text-xs text-destructive">{discountForm.formState.errors.amount.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium" htmlFor="disc-reason">Reason</label>
                      <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="disc-reason" {...discountForm.register("reason")} />
                      {discountForm.formState.errors.reason && <p className="text-xs text-destructive">{discountForm.formState.errors.reason.message}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button disabled={discountMutation.isPending} type="submit" size="sm">{discountMutation.isPending ? "Applying…" : "Apply discount"}</Button>
                    <Button onClick={() => setPanel(null)} size="sm" type="button" variant="outline">Cancel</Button>
                  </div>
                </form>
              </section>
            )}

            {panel === "cancel" && (
              <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
                <h2 className="font-semibold text-destructive">Cancel invoice</h2>
                <p className="text-sm text-muted-foreground">This action cannot be undone. All payments must be reversed first.</p>
                {cancelMutation.isError && <p className="text-sm text-destructive" role="alert">{cancelMutation.error.message}</p>}
                <form className="space-y-4" onSubmit={cancelForm.handleSubmit((values) => {
                  setCancelValues(values);
                  setCancelConfirmationOpen(true);
                })}>
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="cancel-reason">Reason</label>
                    <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="cancel-reason" {...cancelForm.register("reason")} />
                    {cancelForm.formState.errors.reason && <p className="text-xs text-destructive">{cancelForm.formState.errors.reason.message}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button disabled={cancelMutation.isPending} type="submit" size="sm" variant="destructive">Continue to cancellation</Button>
                    <Button onClick={() => setPanel(null)} size="sm" type="button" variant="outline">Back</Button>
                  </div>
                </form>
              </section>
            )}

            {/* Invoice summary */}
            <section className="rounded-xl border bg-card p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="font-medium">{inv.patient.firstName} {inv.patient.lastName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{inv.patient.patientCode} · {inv.patient.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Order</p>
                  <Link className="font-medium hover:underline" href={`/orders/${inv.order.id}`}>{inv.order.orderNumber}</Link>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">{formatDateTime(inv.createdAt)}</p>
                  <p className="text-xs text-muted-foreground">by {inv.createdBy.firstName} {inv.createdBy.lastName}</p>
                </div>
                {inv.cancelledAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Cancelled</p>
                    <p className="text-sm">{formatDateTime(inv.cancelledAt)}</p>
                  </div>
                )}
              </div>
            </section>

            {/* Line items */}
            <section className="rounded-xl border bg-card overflow-hidden">
              <h2 className="border-b px-5 py-3 text-sm font-semibold">Tests</h2>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Test</th>
                    <th className="px-5 py-3 text-right font-medium">Qty</th>
                    <th className="px-5 py-3 text-right font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inv.items.slice((itemsPage - 1) * PAGE_SIZE, itemsPage * PAGE_SIZE).map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-3">{item.testNameSnapshot}</td>
                      <td className="px-5 py-3 text-right">{item.quantity}</td>
                      <td className="px-5 py-3 text-right">{formatCurrency(item.priceSnapshot)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/30 text-sm">
                  <tr>
                    <td className="px-5 py-2 text-muted-foreground" colSpan={2}>Subtotal</td>
                    <td className="px-5 py-2 text-right">{formatCurrency(inv.subtotal)}</td>
                  </tr>
                  {Number(inv.discountAmount) > 0 && (
                    <tr>
                      <td className="px-5 py-2 text-muted-foreground" colSpan={2}>Discount</td>
                      <td className="px-5 py-2 text-right text-emerald-700 dark:text-emerald-300">−{formatCurrency(inv.discountAmount)}</td>
                    </tr>
                  )}
                  <tr className="font-semibold">
                    <td className="px-5 py-2" colSpan={2}>Total</td>
                    <td className="px-5 py-2 text-right">{formatCurrency(inv.totalAmount)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2 text-muted-foreground" colSpan={2}>Paid</td>
                    <td className="px-5 py-2 text-right text-emerald-700 dark:text-emerald-300">{formatCurrency(inv.paidAmount)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="px-5 py-2" colSpan={2}>Balance</td>
                    <td className="px-5 py-2 text-right">{formatCurrency(balance)}</td>
                  </tr>
                </tfoot>
              </table>
              {inv.items.length > 0 && (
                <Pagination
                  page={itemsPage}
                  total={inv.items.length}
                  totalPages={Math.ceil(inv.items.length / PAGE_SIZE)}
                  onPageChange={setItemsPage}
                />
              )}
            </section>

            {/* Payments */}
            <section className="rounded-xl border bg-card overflow-hidden">
              <h2 className="border-b px-5 py-3 text-sm font-semibold">Payment history</h2>
              {inv.payments.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">No payments recorded.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Date</th>
                      <th className="px-5 py-3 text-left font-medium">Method</th>
                      <th className="px-5 py-3 text-left font-medium">Reference</th>
                      <th className="px-5 py-3 text-right font-medium">Amount</th>
                      <th className="px-5 py-3 text-left font-medium">Recorded by</th>
                      <th className="px-5 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inv.payments.slice((paymentsPage - 1) * PAGE_SIZE, paymentsPage * PAGE_SIZE).map((payment) => (
                      <tr className={payment.isReversed ? "opacity-50" : ""} key={payment.id}>
                        <td className="px-5 py-3">{formatDateTime(payment.paidAt)}</td>
                        <td className="px-5 py-3">{titleCase(payment.method)}</td>
                        <td className="px-5 py-3 font-mono text-xs">{payment.referenceNumber ?? "—"}</td>
                        <td className="px-5 py-3 text-right">
                          {payment.isReversed ? <s>{formatCurrency(payment.amount)}</s> : formatCurrency(payment.amount)}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{payment.recordedBy.firstName} {payment.recordedBy.lastName}</td>
                        <td className="px-5 py-3">
                          {!payment.isReversed && canAct && (
                            <Button
                              disabled={reverseMutation.isPending}
                              onClick={() => setPaymentToReverse({ id: payment.id, amount: payment.amount })}
                              size="sm"
                              variant="ghost"
                            >
                              Reverse
                            </Button>
                          )}
                          {payment.isReversed && <span className="text-xs text-muted-foreground">Reversed</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {inv.payments.length > 0 && (
                <Pagination
                  page={paymentsPage}
                  total={inv.payments.length}
                  totalPages={Math.ceil(inv.payments.length / PAGE_SIZE)}
                  onPageChange={setPaymentsPage}
                />
              )}
            </section>

            {/* Adjustments */}
            {inv.adjustments.length > 0 && (
              <section className="rounded-xl border bg-card overflow-hidden">
                <h2 className="border-b px-5 py-3 text-sm font-semibold">Adjustments</h2>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Date</th>
                      <th className="px-5 py-3 text-left font-medium">Type</th>
                      <th className="px-5 py-3 text-left font-medium">Reason</th>
                      <th className="px-5 py-3 text-right font-medium">Amount</th>
                      <th className="px-5 py-3 text-left font-medium">Authorized by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inv.adjustments.slice((adjustmentsPage - 1) * PAGE_SIZE, adjustmentsPage * PAGE_SIZE).map((adj) => (
                      <tr key={adj.id}>
                        <td className="px-5 py-3">{formatDateTime(adj.createdAt)}</td>
                        <td className="px-5 py-3">{titleCase(adj.type)}</td>
                        <td className="px-5 py-3 text-muted-foreground">{adj.reason}</td>
                        <td className="px-5 py-3 text-right">{formatCurrency(adj.amount)}</td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{adj.authorizedBy.firstName} {adj.authorizedBy.lastName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination
                  page={adjustmentsPage}
                  total={inv.adjustments.length}
                  totalPages={Math.ceil(inv.adjustments.length / PAGE_SIZE)}
                  onPageChange={setAdjustmentsPage}
                />
              </section>
            )}

            <p className="text-xs text-muted-foreground">Fictional demonstration data only · Not for clinical use</p>
          </div>
        )}
      </QueryState>
    </div>
  );
}
