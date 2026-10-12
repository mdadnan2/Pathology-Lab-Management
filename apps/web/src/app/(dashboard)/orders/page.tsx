"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared/query-state";
import { apiRequest } from "@/lib/api/client";
import { listOrders, listPatients, listTests, listTestPackages, type SampleStatus } from "@/lib/api/laboratory";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const orderSchema = z.object({
  patientId: z.string().uuid("Select a patient."),
  labTestIds: z.array(z.string().uuid()),
  packageIds: z.array(z.string().uuid()),
  notes: z.string().max(1000),
}).refine((values) => values.labTestIds.length + values.packageIds.length > 0, {
  message: "Select at least one test or package.",
  path: ["labTestIds"],
});

type OrderValues = z.infer<typeof orderSchema>;

interface OrderResponse {
  id: string;
  orderNumber: string;
}

const ORDER_STATUSES = [
  "NEW",
  "SAMPLE_COLLECTED",
  "PROCESSING",
  "RESULT_ENTERED",
  "UNDER_REVIEW",
  "APPROVED",
  "REPORT_READY",
  "CANCELLED",
];

const SAMPLE_STATUSES: Array<SampleStatus | ""> = [
  "",
  "PENDING",
  "COLLECTED",
  "PROCESSING",
  "COMPLETED",
  "REJECTED",
  "RECOLLECTION_REQUESTED",
];

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [sampleStatus, setSampleStatus] = useState<SampleStatus | "">("");
  const [patientId, setPatientId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const orders = useQuery({
    queryKey: ["orders", page, search, status, sampleStatus, patientId, from, to],
    queryFn: () => listOrders({
      page,
      search,
      status,
      sampleStatus,
      patientId,
      from: from ? `${from}T00:00:00.000Z` : undefined,
      to: to ? `${to}T23:59:59.999Z` : undefined,
    }),
  });
  const patients = useQuery({
    queryKey: ["patients", "order-selectors"],
    queryFn: () => listPatients(1, "", 100),
    enabled: showForm,
  });
  const patientFilters = useQuery({
    queryKey: ["patients", "order-filter"],
    queryFn: () => listPatients(1, "", 100),
  });
  const tests = useQuery({
    queryKey: ["test-catalogue", "order-selector"],
    queryFn: () => listTests({ activeOnly: true, limit: 100 }),
    enabled: showForm,
  });
  const packages = useQuery({
    queryKey: ["test-packages", "order-selector"],
    queryFn: () => listTestPackages({ limit: 100 }),
    enabled: showForm,
  });
  const form = useForm<OrderValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: { patientId: "", labTestIds: [], packageIds: [], notes: "" },
  });
  const create = useMutation({
    mutationFn: async (values: OrderValues) => {
      const result = await apiRequest<OrderResponse>("/orders", {
        method: "POST",
        data: {
          patientId: values.patientId,
          items: values.labTestIds.map((labTestId) => ({ labTestId })),
          packageIds: values.packageIds,
          ...(values.notes ? { notes: values.notes } : {}),
        },
      });
      return result.data;
    },
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
      markCreated(order.id);
    },
  });
  const [createdId, setCreatedId] = useState("");

  function markCreated(id: string) {
    setCreatedId(id);
    setShowForm(false);
    form.reset();
  }

  const selectedTestIds = form.watch("labTestIds");
  const selectedPackageIds = form.watch("packageIds");
  const estimatedTotal = [
    ...(tests.data?.data ?? [])
      .filter((test) => selectedTestIds.includes(test.id))
      .map((test) => Number(test.price)),
    ...(packages.data?.data ?? [])
      .filter((pkg) => selectedPackageIds.includes(pkg.id))
      .map((pkg) => Number(pkg.price)),
  ].reduce((total, value) => total + value, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Diagnostic workflow</p>
          <h1 className="text-3xl font-semibold tracking-tight">Test orders</h1>
          <p className="text-sm text-muted-foreground">Create and track fictional laboratory orders.</p>
        </div>
        <Button onClick={() => setShowForm((visible) => !visible)}>{showForm ? "Close form" : "Create order"}</Button>
      </header>

      {createdId && (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
          Order and invoice created. <Link className="font-semibold underline" href={`/orders/${createdId}`}>Open order</Link>
        </p>
      )}
      {create.isError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">Could not create order: {create.error.message}</p>}

      {showForm && (
        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-semibold">Create a new order</h2>
          <form className="space-y-5" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="order-patient">Patient</label>
              <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="order-patient" {...form.register("patientId")}>
                <option value="">Select a patient</option>
                {patients.data?.data.map((patient) => <option key={patient.id} value={patient.id}>{patient.patientCode} · {patient.firstName} {patient.lastName} · {patient.phone}</option>)}
              </select>
              {form.formState.errors.patientId?.message && <p className="text-xs text-destructive" role="alert">{form.formState.errors.patientId.message}</p>}
              <Link className="inline-block text-xs font-medium text-primary underline" href="/patients">Register or find a patient</Link>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Individual tests</legend>
              {tests.isPending ? <p className="text-sm text-muted-foreground">Loading active catalogue…</p> : tests.isError ? <p className="text-sm text-destructive" role="alert">Could not load tests: {tests.error.message}</p> : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tests.data.data.map((test) => (
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/30" key={test.id}>
                      <input className="mt-1" type="checkbox" value={test.id} {...form.register("labTestIds")} />
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{test.name}</span><span className="mt-1 block text-xs text-muted-foreground">{test.code} · {test.category.name}</span></span>
                      <span className="text-sm font-medium">{formatCurrency(test.price)}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Fixed-price packages</legend>
              {packages.isPending ? <p className="text-sm text-muted-foreground">Loading active packages…</p> : packages.isError ? <p className="text-sm text-destructive" role="alert">Could not load packages: {packages.error.message}</p> : !packages.data?.data?.length ? <p className="text-sm text-muted-foreground">No active packages available.</p> : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {packages.data.data.map((pkg) => (
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/30" key={pkg.id}>
                      <input className="mt-1" type="checkbox" value={pkg.id} {...form.register("packageIds")} />
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{pkg.name}</span><span className="mt-1 block text-xs text-muted-foreground">{pkg.items.map((item) => item.labTest.code).join(", ")}</span></span>
                      <span className="text-sm font-medium">{formatCurrency(pkg.price)}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            {(form.formState.errors.labTestIds?.message || form.formState.errors.packageIds?.message) && <p className="text-sm text-destructive" role="alert">Select at least one test or package.</p>}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="order-notes">Order notes (optional)</label>
              <textarea className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm" id="order-notes" {...form.register("notes")} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
              <div><p className="text-xs text-muted-foreground">Estimated total · server calculates final invoice</p><p className="text-lg font-semibold">{formatCurrency(estimatedTotal)}</p></div>
              <Button disabled={create.isPending} type="submit">{create.isPending ? "Creating order…" : "Create order & invoice"}</Button>
            </div>
            <p className="text-xs text-muted-foreground">Package contents become individual order tests. The server assigns price snapshots and generates the invoice atomically. Displayed prices are illustrative demo values.</p>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <span className="sr-only">Search orders</span>
            <input className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm" onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Order, patient, or patient ID" value={search} />
          </label>
          <select aria-label="Filter by order status" className="h-10 rounded-lg border bg-background px-3 text-sm" onChange={(event) => { setStatus(event.target.value); setPage(1); }} value={status}>
            <option value="">All order statuses</option>
            {ORDER_STATUSES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
          </select>
          <select aria-label="Filter by sample status" className="h-10 rounded-lg border bg-background px-3 text-sm" onChange={(event) => { setSampleStatus(event.target.value as SampleStatus | ""); setPage(1); }} value={sampleStatus}>
            {SAMPLE_STATUSES.map((value) => <option key={value || "all"} value={value}>{value ? titleCase(value) : "All sample statuses"}</option>)}
          </select>
          <select aria-label="Filter by patient" className="h-10 rounded-lg border bg-background px-3 text-sm" onChange={(event) => { setPatientId(event.target.value); setPage(1); }} value={patientId}>
            <option value="">All patients</option>
            {patientFilters.data?.data?.map((patient) => <option key={patient.id} value={patient.id}>{patient.patientCode} · {patient.firstName} {patient.lastName}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">From<input aria-label="Orders from date" className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm text-foreground" onChange={(event) => { setFrom(event.target.value); setPage(1); }} type="date" value={from} /></label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">To<input aria-label="Orders to date" className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm text-foreground" onChange={(event) => { setTo(event.target.value); setPage(1); }} type="date" value={to} /></label>
        </div>
        <QueryState error={orders.error} loading={orders.isPending} onRetry={() => void orders.refetch()}>
          {!orders.data?.data?.length ? <p className="p-8 text-center text-sm text-muted-foreground">No orders found for these filters.</p> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Order</th><th className="px-5 py-3 font-medium">Patient</th><th className="px-5 py-3 font-medium">Tests</th><th className="px-5 py-3 font-medium">Sample</th><th className="px-5 py-3 font-medium">Amount</th><th className="px-5 py-3 font-medium">Status</th></tr></thead>
                  <tbody className="divide-y">
                    {orders.data.data.map((order) => (
                      <tr className="hover:bg-muted/30" key={order.id}>
                        <td className="px-5 py-4"><Link className="font-medium hover:underline" href={`/orders/${order.id}`}>{order.orderNumber}</Link><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p></td>
                        <td className="px-5 py-4"><p>{order.patient.firstName} {order.patient.lastName}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{order.patient.patientCode}</p></td>
                        <td className="px-5 py-4">{order.items.length} tests</td>
                        <td className="px-5 py-4">{order.samples.map((sample) => titleCase(sample.status)).join(", ") || "—"}</td>
                        <td className="px-5 py-4">{order.invoice ? formatCurrency(order.invoice.totalAmount) : "—"}</td>
                        <td className="px-5 py-4">{titleCase(order.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t px-5 py-4">
                <p className="text-sm text-muted-foreground">Page {orders.data.meta.page} of {Math.max(orders.data.meta.totalPages, 1)} · {orders.data.meta.total} orders</p>
                <div className="flex gap-2">
                  <Button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} size="sm" variant="outline">Previous</Button>
                  <Button disabled={page >= orders.data.meta.totalPages} onClick={() => setPage((current) => current + 1)} size="sm" variant="outline">Next</Button>
                </div>
              </div>
            </>
          )}
        </QueryState>
      </section>
    </div>
  );
}
