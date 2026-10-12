"use client";

import { QueryState } from "@/components/shared/query-state";
import { listInvoices, listPatients, type InvoiceStatus } from "@/lib/api/laboratory";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const INVOICE_STATUSES: Array<InvoiceStatus | ""> = ["", "UNPAID", "PARTIALLY_PAID", "PAID", "CANCELLED"];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  UNPAID: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-900",
  PARTIALLY_PAID: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/50 dark:border-blue-900",
  PAID: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-900",
  CANCELLED: "text-muted-foreground bg-muted border-border",
};

export default function BillingPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [patientId, setPatientId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const invoices = useQuery({
    queryKey: ["invoices", page, search, status, patientId, from, to],
    queryFn: () => listInvoices({
      page, search, status, patientId,
      from: from ? `${from}T00:00:00.000Z` : undefined,
      to: to ? `${to}T23:59:59.999Z` : undefined,
    }),
  });

  const patients = useQuery({
    queryKey: ["patients", "billing-filter"],
    queryFn: () => listPatients(1, "", 100),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Finance</p>
        <h1 className="text-3xl font-semibold tracking-tight">Billing &amp; invoices</h1>
        <p className="text-sm text-muted-foreground">View and manage fictional demo invoices.</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link href="/billing/outstanding">
          <Button variant="outline" size="sm">Outstanding dues</Button>
        </Link>
        <Link href="/billing/collections">
          <Button variant="outline" size="sm">Daily collections</Button>
        </Link>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <span className="sr-only">Search invoices</span>
            <input
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Invoice number or patient"
              value={search}
            />
          </label>
          <select
            aria-label="Filter by status"
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            onChange={(e) => { setStatus(e.target.value as InvoiceStatus | ""); setPage(1); }}
            value={status}
          >
            {INVOICE_STATUSES.map((s) => (
              <option key={s || "all"} value={s}>{s ? titleCase(s) : "All statuses"}</option>
            ))}
          </select>
          <select
            aria-label="Filter by patient"
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            onChange={(e) => { setPatientId(e.target.value); setPage(1); }}
            value={patientId}
          >
            <option value="">All patients</option>
            {patients.data?.data.map((p) => (
              <option key={p.id} value={p.id}>{p.patientCode} · {p.firstName} {p.lastName}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            From
            <input
              aria-label="From date"
              className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm text-foreground"
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              type="date"
              value={from}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            To
            <input
              aria-label="To date"
              className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm text-foreground"
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              type="date"
              value={to}
            />
          </label>
        </div>

        <QueryState error={invoices.error} loading={invoices.isPending} onRetry={() => void invoices.refetch()}>
          {!invoices.data?.data?.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No invoices found for these filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Invoice</th>
                      <th className="px-5 py-3 font-medium">Patient</th>
                      <th className="px-5 py-3 font-medium">Total</th>
                      <th className="px-5 py-3 font-medium">Paid</th>
                      <th className="px-5 py-3 font-medium">Balance</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.data.data.map((inv) => {
                      const balance = (Number(inv.totalAmount) - Number(inv.paidAmount)).toFixed(2);
                      return (
                        <tr className="hover:bg-muted/30" key={inv.id}>
                          <td className="px-5 py-4">
                            <Link className="font-medium hover:underline" href={`/billing/${inv.id}`}>
                              {inv.invoiceNumber}
                            </Link>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(inv.createdAt)}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p>{inv.patient.firstName} {inv.patient.lastName}</p>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">{inv.patient.patientCode}</p>
                          </td>
                          <td className="px-5 py-4 font-medium">{formatCurrency(inv.totalAmount)}</td>
                          <td className="px-5 py-4">{formatCurrency(inv.paidAmount)}</td>
                          <td className="px-5 py-4">{formatCurrency(balance)}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                              {titleCase(inv.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t px-5 py-4">
                <p className="text-sm text-muted-foreground">
                  Page {invoices.data.meta.page} of {Math.max(invoices.data.meta.totalPages, 1)} · {invoices.data.meta.total} invoices
                </p>
                <div className="flex gap-2">
                  <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} size="sm" variant="outline">Previous</Button>
                  <Button disabled={page >= invoices.data.meta.totalPages} onClick={() => setPage((p) => p + 1)} size="sm" variant="outline">Next</Button>
                </div>
              </div>
            </>
          )}
        </QueryState>
      </section>
    </div>
  );
}
