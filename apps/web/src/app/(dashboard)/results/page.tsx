"use client";

import { QueryState } from "@/components/shared/query-state";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/api/auth";
import {
  listResults,
  reviewResult,
  saveResultDraft,
  submitResult,
  type ResultStatus,
  type ResultWorkItem,
} from "@/lib/api/laboratory";
import { titleCase } from "@/lib/format";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const RESULT_STATUSES: Array<ResultStatus | ""> = [
  "",
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
];

const resultEntrySchema = z.object({
  values: z.record(z.string(), z.string().max(100)),
  notes: z.string().max(2000),
});
type ResultEntryValues = z.infer<typeof resultEntrySchema>;

export default function ResultsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ResultStatus | "">("");
  const [page, setPage] = useState(1);
  const profile = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentUser });
  const results = useQuery({
    queryKey: ["results", page, status],
    queryFn: () => listResults({ page, limit: 10, status }),
  });
  const canEnter = profile.data
    ? ["OWNER", "ADMIN", "TECHNICIAN"].includes(profile.data.role)
    : false;
  const canReview = profile.data
    ? ["OWNER", "ADMIN", "PATHOLOGIST"].includes(profile.data.role)
    : false;
  const refreshResults = () => queryClient.invalidateQueries({ queryKey: ["results"] });

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Laboratory workflow</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Results</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter fictional demo values and submit them for Pathologist review. Reference ranges are illustrative only.
        </p>
      </header>
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b p-4">
          <label className="sr-only" htmlFor="result-status-filter">Filter results by status</label>
          <select
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            id="result-status-filter"
            onChange={(event) => {
              setStatus(event.target.value as ResultStatus | "");
              setPage(1);
            }}
            value={status}
          >
            {RESULT_STATUSES.map((value) => (
              <option key={value || "all"} value={value}>
                {value ? titleCase(value) : "All result statuses"}
              </option>
            ))}
          </select>
        </div>
        <QueryState error={results.error} loading={results.isPending} onRetry={() => void results.refetch()}>
          {!results.data?.data.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No eligible order items or results found.
            </p>
          ) : (
            <div className="divide-y">
              {results.data.data.map((item) => (
                <ResultItem
                  canEnter={canEnter}
                  canReview={canReview}
                  item={item}
                  key={item.id}
                  onChanged={refreshResults}
                />
              ))}
            </div>
          )}
        </QueryState>
        {results.data?.meta && results.data.meta.total > 0 && (
          <Pagination
            page={results.data.meta.page}
            total={results.data.meta.total}
            totalPages={results.data.meta.totalPages}
            onPageChange={setPage}
          />
        )}
      </section>
    </div>
  );
}

function ResultItem({
  item,
  canEnter,
  canReview,
  onChanged,
}: {
  item: ResultWorkItem;
  canEnter: boolean;
  canReview: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const editable =
    canEnter &&
    (!item.result || item.result.status === "DRAFT" || item.result.status === "REJECTED");
  const form = useForm<ResultEntryValues>({
    resolver: zodResolver(resultEntrySchema),
    defaultValues: {
      values: Object.fromEntries(
        item.result?.parameters.map((parameter) => [parameter.testParameterId, parameter.value]) ?? [],
      ),
      notes: item.result?.notes ?? "",
    },
  });
  const save = useMutation({
    mutationFn: (values: ResultEntryValues) =>
      saveResultDraft(item.id, {
        parameters: item.labTest.parameters
          .filter((parameter) => values.values[parameter.id] !== undefined)
          .map((parameter) => ({
            testParameterId: parameter.id,
            value: values.values[parameter.id],
          })),
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
      }),
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const submit = useMutation({
    mutationFn: async (values: ResultEntryValues) => {
      const missing = item.labTest.parameters.some(
        (parameter) => !values.values[parameter.id]?.trim(),
      );
      if (missing) throw new Error("Enter a value for every parameter before submitting.");
      const saved = await saveResultDraft(item.id, {
        parameters: item.labTest.parameters.map((parameter) => ({
          testParameterId: parameter.id,
          value: values.values[parameter.id].trim(),
        })),
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
      });
      if (!saved) throw new Error("The result draft could not be saved.");
      await submitResult(saved.id);
    },
    onSuccess: () => {
      setError(null);
      onChanged();
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const review = useMutation({
    mutationFn: (next: "UNDER_REVIEW" | "APPROVED" | "REJECTED") =>
      reviewResult(item.result!.id, next, next === "REJECTED" ? rejectReason.trim() : undefined),
    onSuccess: () => {
      setError(null);
      onChanged();
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const resultStatus = item.result?.status;
  const pending = save.isPending || submit.isPending || review.isPending;

  return (
    <article className="space-y-4 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{item.testNameSnapshot}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.order.orderNumber} · {item.order.patient.firstName} {item.order.patient.lastName} · {item.order.patient.patientCode}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs">
          {resultStatus ? titleCase(resultStatus) : "Not entered"}
        </span>
      </header>
      {item.result?.rejectionReason && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Rejection reason: {item.result.rejectionReason}
        </p>
      )}
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => submit.mutate(values))}
      >
        {item.labTest.parameters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No result parameters are configured for this test.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {item.labTest.parameters.map((parameter) => {
              const savedValue = item.result?.parameters.find(
                (value) => value.testParameterId === parameter.id,
              );
              const range = parameter.referenceRangeText
                ?? `${parameter.referenceRangeLow ?? "—"} – ${parameter.referenceRangeHigh ?? "—"}`;
              return (
                <label className="space-y-1 text-sm" htmlFor={`${item.id}-${parameter.id}`} key={parameter.id}>
                  <span className="font-medium">{parameter.name} {parameter.unit ? `(${parameter.unit})` : ""}</span>
                  <input
                    aria-label={`${parameter.name} value`}
                    className="h-10 w-full rounded-lg border bg-background px-3"
                    disabled={!editable || pending}
                    id={`${item.id}-${parameter.id}`}
                    {...form.register(`values.${parameter.id}`)}
                  />
                  <span className="block text-xs text-muted-foreground">
                    Illustrative reference range: {range}
                    {savedValue?.isAbnormal ? " · Outside range" : ""}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <label className="block space-y-1 text-sm" htmlFor={`${item.id}-notes`}>
          <span className="font-medium">Notes</span>
          <textarea
            className="min-h-20 w-full rounded-lg border bg-background p-3"
            disabled={!editable || pending}
            id={`${item.id}-notes`}
            {...form.register("notes")}
          />
        </label>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending}
              onClick={form.handleSubmit((values) => save.mutate(values))}
              type="button"
              variant="outline"
            >
              {save.isPending ? "Saving…" : "Save draft"}
            </Button>
            <Button disabled={pending || item.labTest.parameters.length === 0} type="submit">
              {submit.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        )}
      </form>
      {canReview && resultStatus === "SUBMITTED" && (
        <Button
          disabled={pending}
          onClick={() => review.mutate("UNDER_REVIEW")}
          size="sm"
        >
          Start review
        </Button>
      )}
      {canReview && resultStatus === "UNDER_REVIEW" && (
        <div className="flex flex-wrap items-end gap-2">
          <Button disabled={pending} onClick={() => review.mutate("APPROVED")} size="sm">
            Approve result
          </Button>
          <label className="min-w-56 flex-1 text-xs text-muted-foreground">
            Rejection reason (required)
            <input
              className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-sm text-foreground"
              onChange={(event) => setRejectReason(event.target.value)}
              value={rejectReason}
            />
          </label>
          <Button
            disabled={pending || !rejectReason.trim()}
            onClick={() => review.mutate("REJECTED")}
            size="sm"
            variant="outline"
          >
            Reject result
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {resultStatus === "APPROVED" && (
        <p className="text-sm text-muted-foreground">Approved results are locked and cannot be changed.</p>
      )}
    </article>
  );
}
