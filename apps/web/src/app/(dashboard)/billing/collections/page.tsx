"use client";

import { QueryState } from "@/components/shared/query-state";
import { Pagination } from "@/components/shared/pagination";
import { getDailyCollections, PAGE_SIZE, type PaymentMethod } from "@/lib/api/laboratory";
import { formatCurrency, titleCase } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

const METHODS: PaymentMethod[] = ["CASH", "CARD", "UPI", "BANK_TRANSFER"];

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().slice(0, 10);
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

export default function CollectionsPage() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [page, setPage] = useState(1);

  const collections = useQuery({
    queryKey: ["collections", from, to],
    queryFn: () => getDailyCollections(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`),
    enabled: !!from && !!to,
  });

  const grandTotal = collections.data?.rows.reduce(
    (sum, row) => sum + Number(row.totalCollected),
    0,
  ) ?? 0;
  const visibleRows = collections.data?.rows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  ) ?? [];
  const totalPages = Math.ceil((collections.data?.rows.length ?? 0) / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="space-y-2">
        <Link className="text-sm text-muted-foreground hover:underline" href="/billing">← Billing</Link>
        <h1 className="text-3xl font-semibold tracking-tight">Daily collections</h1>
        <p className="text-sm text-muted-foreground">Fictional demo payment totals by date.</p>
      </header>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4">
        <label className="flex items-center gap-2 text-sm">
          From
          <input
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            type="date"
            value={from}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          To
          <input
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            type="date"
            value={to}
          />
        </label>
      </div>

      {collections.data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs text-muted-foreground">Total collected (period)</p>
            <p className="mt-1 text-2xl font-semibold">{formatCurrency(grandTotal)}</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs text-muted-foreground">Total outstanding (all time)</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(collections.data.outstanding)}</p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <QueryState error={collections.error} loading={collections.isPending} onRetry={() => void collections.refetch()}>
          {!collections.data?.rows?.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No payments in this date range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                    {METHODS.map((m) => (
                      <th className="px-5 py-3 text-right font-medium" key={m}>{titleCase(m)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleRows.map((row) => (
                    <tr className="hover:bg-muted/30" key={row.date}>
                      <td className="px-5 py-3 font-medium">{row.date}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatCurrency(row.totalCollected)}</td>
                      {METHODS.map((m) => (
                        <td className="px-5 py-3 text-right text-muted-foreground" key={m}>
                          {row.byMethod[m] ? formatCurrency(row.byMethod[m]!) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/30 font-semibold">
                  <tr>
                    <td className="px-5 py-3">Total</td>
                    <td className="px-5 py-3 text-right">{formatCurrency(grandTotal)}</td>
                    {METHODS.map((m) => {
                      const methodTotal = collections.data.rows.reduce(
                        (sum, row) => sum + Number(row.byMethod[m] ?? 0),
                        0,
                      );
                      return (
                        <td className="px-5 py-3 text-right" key={m}>
                          {methodTotal > 0 ? formatCurrency(methodTotal) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </QueryState>
        {collections.data?.rows.length ? (
          <Pagination
            page={page}
            total={collections.data.rows.length}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </section>
    </div>
  );
}
