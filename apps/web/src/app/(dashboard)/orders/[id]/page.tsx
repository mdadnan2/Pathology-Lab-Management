"use client";

import { QueryState } from "@/components/shared/query-state";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { getOrder, updateSampleStatus, PAGE_SIZE, type LabOrder, type SampleStatus } from "@/lib/api/laboratory";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

const NEXT_SAMPLE_STATUSES: Partial<Record<SampleStatus, SampleStatus[]>> = {
  PENDING: ["COLLECTED", "REJECTED"],
  COLLECTED: ["PROCESSING", "REJECTED"],
  PROCESSING: ["COMPLETED", "REJECTED"],
  REJECTED: ["RECOLLECTION_REQUESTED"],
  RECOLLECTION_REQUESTED: ["COLLECTED"],
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const order = useQuery({
    queryKey: ["orders", params.id],
    queryFn: () => getOrder(params.id),
  });
  const updateSample = useMutation({
    mutationFn: (input: { id: string; status: SampleStatus; rejectionReason?: string }) =>
      updateSampleStatus(input.id, {
        status: input.status,
        ...(input.rejectionReason ? { rejectionReason: input.rejectionReason } : {}),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders", params.id] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["samples"] }),
      ]);
      setRejectionReasons({});
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <Link className="text-sm font-medium text-primary underline" href="/orders">← Back to orders</Link>
      <QueryState error={order.error} loading={order.isPending} onRetry={() => void order.refetch()}>
        {order.data && <OrderDetails
          order={order.data}
          rejectionReasons={rejectionReasons}
          setRejectionReasons={setRejectionReasons}
          onUpdate={(id, status) => updateSample.mutate({
            id,
            status,
            ...(status === "REJECTED" ? { rejectionReason: rejectionReasons[id]?.trim() } : {}),
          })}
          pending={updateSample.isPending}
        />}
      </QueryState>
      {updateSample.isError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">Sample update failed: {updateSample.error.message}</p>}
    </div>
  );
}

function OrderDetails({
  order,
  rejectionReasons,
  setRejectionReasons,
  onUpdate,
  pending,
}: {
  order: LabOrder;
  rejectionReasons: Record<string, string>;
  setRejectionReasons: (value: Record<string, string>) => void;
  onUpdate: (id: string, status: SampleStatus) => void;
  pending: boolean;
}) {
  const [itemsPage, setItemsPage] = useState(1);
  const [samplesPage, setSamplesPage] = useState(1);
  const [sampleToReject, setSampleToReject] = useState<string | null>(null);

  return (
    <>
      <ConfirmationDialog
        open={sampleToReject !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setSampleToReject(null);
        }}
        title="Reject sample?"
        description="Rejecting the sample will require a recollection before processing can continue."
        confirmLabel="Reject sample"
        onConfirm={() => {
          if (sampleToReject) onUpdate(sampleToReject, "REJECTED");
          setSampleToReject(null);
        }}
        isPending={pending}
        destructive
      />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Laboratory order</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{order.orderNumber}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Created {formatDateTime(order.createdAt)} · {titleCase(order.status)}</p>
        </div>
        <div className="rounded-xl border bg-card px-5 py-3 text-right">
          <p className="text-xs text-muted-foreground">Invoice total</p>
          <p className="text-xl font-semibold">{order.invoice ? formatCurrency(order.invoice.totalAmount) : "Not invoiced"}</p>
          {order.invoice && <p className="mt-1 text-xs text-muted-foreground">{order.invoice.invoiceNumber} · {titleCase(order.invoice.status)}</p>}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Patient</h2>
          <p className="mt-3">{order.patient.firstName} {order.patient.lastName}</p>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{order.patient.patientCode}</p>
          <p className="mt-1 text-sm text-muted-foreground">{order.patient.phone}</p>
          <Link className="mt-3 inline-block text-sm text-primary underline" href={`/patients/${order.patient.id}`}>View patient record</Link>
        </article>
        <article className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Order notes</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{order.notes || "No notes recorded."}</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <h2 className="border-b p-5 font-semibold">Ordered tests</h2>
        <div className="divide-y">
          {order.items.slice((itemsPage - 1) * PAGE_SIZE, itemsPage * PAGE_SIZE).map((item) => (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" key={item.id}>
              <div><p className="font-medium">{item.testNameSnapshot}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{item.labTest.code} · {titleCase(item.status)}</p></div>
              <p className="font-medium">{formatCurrency(item.priceSnapshot)}</p>
            </div>
          ))}
        </div>
        {order.items.length > 0 && (
          <Pagination
            page={itemsPage}
            total={order.items.length}
            totalPages={Math.ceil(order.items.length / PAGE_SIZE)}
            onPageChange={setItemsPage}
          />
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Sample tracking</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sample completion is distinct from result entry and report approval.</p>
        </div>
        {!order.samples.length ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">No samples are linked to this order.</p> : (
          <>
            {order.samples.slice((samplesPage - 1) * PAGE_SIZE, samplesPage * PAGE_SIZE).map((sample) => {
              const options = NEXT_SAMPLE_STATUSES[sample.status] ?? [];
              return (
                <article className="rounded-xl border bg-card p-5" key={sample.id ?? sample.sampleId}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-medium">{sample.sampleId}</p><p className="mt-1 text-sm text-muted-foreground">Current status: {titleCase(sample.status)}</p></div>
                    <div className="flex flex-wrap gap-2">
                      {options.map((status) => (
                        <Button
                          disabled={pending || (status === "REJECTED" && !rejectionReasons[sample.id ?? ""]?.trim())}
                          key={status}
                          onClick={() => {
                            if (!sample.id) return;
                            if (status === "REJECTED") setSampleToReject(sample.id);
                            else onUpdate(sample.id, status);
                          }}
                          size="sm"
                          variant={status === "REJECTED" ? "outline" : "default"}
                        >{status === "RECOLLECTION_REQUESTED" ? "Request recollection" : titleCase(status)}</Button>
                      ))}
                    </div>
                  </div>
                  {sample.status !== "COMPLETED" && sample.status !== "REJECTED" && (
                    <label className="mt-4 block max-w-xl space-y-2 text-sm">
                      <span>Rejection reason (required only when rejecting)</span>
                      <input className="h-10 w-full rounded-lg border bg-background px-3" onChange={(event) => setRejectionReasons({ ...rejectionReasons, [sample.id ?? ""]: event.target.value })} value={rejectionReasons[sample.id ?? ""] ?? ""} />
                    </label>
                  )}
                </article>
              );
            })}
            <Pagination
              page={samplesPage}
              total={order.samples.length}
              totalPages={Math.ceil(order.samples.length / PAGE_SIZE)}
              onPageChange={setSamplesPage}
            />
          </>
        )}
      </section>
    </>
  );
}
