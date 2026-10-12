"use client";

import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared/query-state";
import { listOutstandingDues } from "@/lib/api/laboratory";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

export default function OutstandingDuesPage() {
  const [page, setPage] = useState(1);

  const dues = useQuery({
    queryKey: ["invoices", "outstanding", page],
    queryFn: () => listOutstandingDues(page),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="space-y-2">
        <Link className="text-sm text-muted-foreground hover:underline" href="/billing">← Billing</Link>
        <h1 className="text-3xl font-semibold tracking-tight">Outstanding dues</h1>
        <p className="text-sm text-muted-foreground">Unpaid and partially paid fictional demo invoices.</p>
      </header>

      <section className="overflow-hidden rounded-xl border bg-card">
        <QueryState error={dues.error} loading={dues.isPending} onRetry={() => void dues.refetch()}>
          {!dues.data?.data?.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No outstanding invoices.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Invoice</th>
                      <th className="px-5 py-3 font-medium">Patient</th>
                      <th className="px-5 py-3 font-medium">Order</th>
                      <th className="px-5 py-3 font-medium">Total</th>
                      <th className="px-5 py-3 font-medium">Paid</th>
                      <th className="px-5 py-3 font-medium">Balance</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dues.data.data.map((inv) => {
                      const balance = (Number(inv.totalAmount) - Number(inv.paidAmount)).toFixed(2);
                      return (
                        <tr className="hover:bg-muted/30" key={inv.id}>
                          <td className="px-5 py-4">
                            <Link className="font-medium hover:underline" href={`/billing/${inv.id}`}>{inv.invoiceNumber}</Link>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(inv.createdAt)}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p>{inv.patient.firstName} {inv.patient.lastName}</p>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">{inv.patient.patientCode}</p>
                          </td>
                          <td className="px-5 py-4 font-mono text-xs">{inv.order.orderNumber}</td>
                          <td className="px-5 py-4">{formatCurrency(inv.totalAmount)}</td>
                          <td className="px-5 py-4">{formatCurrency(inv.paidAmount)}</td>
                          <td className="px-5 py-4 font-semibold">{formatCurrency(balance)}</td>
                          <td className="px-5 py-4 text-xs">{titleCase(inv.status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t px-5 py-4">
                <p className="text-sm text-muted-foreground">
                  Page {dues.data.meta.page} of {Math.max(dues.data.meta.totalPages, 1)} · {dues.data.meta.total} invoices
                </p>
                <div className="flex gap-2">
                  <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} size="sm" variant="outline">Previous</Button>
                  <Button disabled={page >= dues.data.meta.totalPages} onClick={() => setPage((p) => p + 1)} size="sm" variant="outline">Next</Button>
                </div>
              </div>
            </>
          )}
        </QueryState>
      </section>
    </div>
  );
}
