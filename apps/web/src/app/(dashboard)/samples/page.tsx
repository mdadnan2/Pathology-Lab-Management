"use client";

import { QueryState } from "@/components/shared/query-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { listSamples, updateSampleStatus, type SampleStatus } from "@/lib/api/laboratory";
import { getCurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, titleCase } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

const SAMPLE_STATUSES: Array<SampleStatus | ""> = ["", "PENDING", "COLLECTED", "PROCESSING", "COMPLETED", "REJECTED", "RECOLLECTION_REQUESTED"];
const NEXT_STATUS: Partial<Record<SampleStatus, SampleStatus[]>> = {
  PENDING: ["COLLECTED", "REJECTED"],
  COLLECTED: ["PROCESSING", "REJECTED"],
  PROCESSING: ["COMPLETED", "REJECTED"],
  REJECTED: ["RECOLLECTION_REQUESTED"],
  RECOLLECTION_REQUESTED: ["COLLECTED"],
};

export default function SamplesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SampleStatus | "">("");
  const [page, setPage] = useState(1);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [sampleToReject, setSampleToReject] = useState<{ id: string; rejectionReason: string } | null>(null);
  const profile = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentUser, retry: false });
  const canUpdateSamples = profile.data?.permissions.includes("samples.update_status") ?? false;
  const samples = useQuery({ queryKey: ["samples", page, status], queryFn: () => listSamples({ page, status }) });
  const update = useMutation({
    mutationFn: (input: { id: string; status: SampleStatus; rejectionReason?: string }) =>
      updateSampleStatus(input.id, {
        status: input.status,
        ...(input.rejectionReason ? { rejectionReason: input.rejectionReason } : {}),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["samples"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
      setReasons({});
      setSampleToReject(null);
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <ConfirmationDialog
        open={sampleToReject !== null}
        onOpenChange={(open) => {
          if (!open && !update.isPending) setSampleToReject(null);
        }}
        title="Reject sample?"
        description={
          update.isError
            ? `Could not reject sample: ${update.error.message}`
            : "Rejecting the sample will require a recollection before processing can continue."
        }
        confirmLabel="Reject sample"
        onConfirm={() => {
          if (sampleToReject) {
            update.mutate({
              ...sampleToReject,
              status: "REJECTED",
            });
          }
        }}
        isPending={update.isPending}
        destructive
      />
      <header>
        <p className="text-sm font-medium text-muted-foreground">Specimen workflow</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sample tracking</h1>
        <p className="mt-2 text-sm text-muted-foreground">Track collection, processing, rejection, and recollection.</p>
      </header>
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b p-4">
          <label className="sr-only" htmlFor="sample-status-filter">Filter samples by status</label>
          <select className="h-10 rounded-lg border bg-background px-3 text-sm" id="sample-status-filter" onChange={(event) => { setStatus(event.target.value as SampleStatus | ""); setPage(1); }} value={status}>
            {SAMPLE_STATUSES.map((value) => <option key={value || "all"} value={value}>{value ? titleCase(value) : "All sample statuses"}</option>)}
          </select>
        </div>
        <QueryState error={samples.error} loading={samples.isPending} onRetry={() => void samples.refetch()}>
          {!samples.data?.data?.length ? <p className="p-8 text-center text-sm text-muted-foreground">No samples found.</p> : (
            <div className="divide-y">
              {samples.data.data.map((sample) => {
                const nextStatuses = NEXT_STATUS[sample.status] ?? [];
                return (
                  <article className="space-y-4 p-5" key={sample.id}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{sample.sampleId} <span className="ml-2 rounded-full bg-muted px-2 py-1 text-xs font-normal">{titleCase(sample.status)}</span></p>
                        <p className="mt-2 text-sm">{sample.order.patient.firstName} {sample.order.patient.lastName} · <span className="font-mono text-xs text-muted-foreground">{sample.order.patient.patientCode}</span></p>
                        <p className="mt-1 text-sm text-muted-foreground">{sample.order.items.map((item) => `${item.labTest.code} · ${item.testNameSnapshot}`).join(", ")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Received {formatDateTime(sample.createdAt)}</p>
                        {sample.rejectionReason && <p className="mt-2 text-sm text-destructive">Rejection: {sample.rejectionReason}</p>}
                      </div>
                      <Link className="text-sm font-medium text-primary underline" href={`/orders/${sample.order.id}`}>{sample.order.orderNumber}</Link>
                    </div>
                    {canUpdateSamples && nextStatuses.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        {nextStatuses.map((next) => (
                          <Button
                            disabled={update.isPending || (next === "REJECTED" && !reasons[sample.id]?.trim())}
                            key={next}
                            onClick={() => next === "REJECTED"
                              ? setSampleToReject({ id: sample.id, rejectionReason: reasons[sample.id]?.trim() ?? "" })
                              : update.mutate({ id: sample.id, status: next })}
                            size="sm"
                            variant={next === "REJECTED" ? "outline" : "default"}
                          >{next === "RECOLLECTION_REQUESTED" ? "Request recollection" : titleCase(next)}</Button>
                        ))}
                        {!["COMPLETED", "REJECTED"].includes(sample.status) && (
                          <label className="min-w-56 flex-1 text-xs text-muted-foreground">
                            Rejection reason (required to reject)
                            <input className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-sm text-foreground" onChange={(event) => setReasons({ ...reasons, [sample.id]: event.target.value })} value={reasons[sample.id] ?? ""} />
                          </label>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </QueryState>
        {!profile.isPending && !canUpdateSamples && (
          <p className="border-t p-4 text-sm text-muted-foreground" role="status">
            You can view samples, but your role does not allow changing sample statuses.
          </p>
        )}
        {update.isError && <p className="border-t p-4 text-sm text-destructive" role="alert">
          {update.error instanceof ApiError && update.error.statusCode === 403
            ? "You do not have permission to change sample statuses."
            : `Could not update sample: ${update.error.message}`}
        </p>}
        {samples.data?.meta && samples.data.meta.total > 0 && (
          <Pagination
            page={samples.data.meta.page}
            total={samples.data.meta.total}
            totalPages={samples.data.meta.totalPages}
            onPageChange={setPage}
          />
        )}
      </section>
    </div>
  );
}
