"use client";

import { Pagination } from "@/components/shared/pagination";
import { QueryState } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/api/auth";
import {
  approveReport,
  downloadReport,
  generateReport,
  listReportEligibleOrders,
  listReports,
  type LabReport,
} from "@/lib/api/laboratory";
import { titleCase } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const profile = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentUser });
  const reports = useQuery({
    queryKey: ["reports", page],
    queryFn: () => listReports({ page, limit: 10 }),
  });
  const canApprove = profile.data
    ? ["OWNER", "ADMIN", "PATHOLOGIST"].includes(profile.data.role)
    : false;
  const eligibleOrders = useQuery({
    queryKey: ["orders", "approved-for-report"],
    queryFn: () => listReportEligibleOrders({ page: 1, limit: 100 }),
    enabled: canApprove,
  });
  const invalidateReports = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
      queryClient.invalidateQueries({ queryKey: ["orders", "approved-for-report"] }),
    ]);
  };
  const generate = useMutation({
    mutationFn: generateReport,
    onSuccess: async () => {
      setSelectedOrderId("");
      setMessage("Report generated and is awaiting approval.");
      await invalidateReports();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const approve = useMutation({
    mutationFn: approveReport,
    onSuccess: async () => {
      setMessage("Report approved and ready for delivery.");
      await invalidateReports();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Patient reports</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reports are generated only after every result is approved. All generated PDFs are clearly marked as fictional demo data.
        </p>
      </header>
      {canApprove && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Generate report</h2>
          <p className="mt-1 text-sm text-muted-foreground">Select an order whose test results have all been approved.</p>
          {eligibleOrders.isError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">{eligibleOrders.error.message}</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="sr-only" htmlFor="report-order">Approved order</label>
              <select
                className="h-10 min-w-64 rounded-lg border bg-background px-3 text-sm"
                disabled={eligibleOrders.isPending || generate.isPending || !eligibleOrders.data?.data.length}
                id="report-order"
                onChange={(event) => setSelectedOrderId(event.target.value)}
                value={selectedOrderId}
              >
                <option value="">Choose an approved order</option>
                {(eligibleOrders.data?.data ?? []).map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} · {order.patient.firstName} {order.patient.lastName}
                  </option>
                ))}
              </select>
              <Button
                disabled={generate.isPending || !selectedOrderId}
                onClick={() => generate.mutate(selectedOrderId)}
              >
                {generate.isPending ? "Generating…" : "Generate report"}
              </Button>
            </div>
          )}
          {eligibleOrders.data && eligibleOrders.data.data.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">No approved orders are ready for report generation.</p>
          )}
        </section>
      )}
      {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
      <section className="overflow-hidden rounded-xl border bg-card">
        <QueryState error={reports.error} loading={reports.isPending} onRetry={() => void reports.refetch()}>
          {!reports.data?.data.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No reports have been generated yet.</p>
          ) : (
            <div className="divide-y">
              {reports.data.data.map((report) => (
                <ReportRow
                  canApprove={canApprove}
                  key={report.id}
                  onApprove={() => approve.mutate(report.id)}
                  pending={approve.isPending && approve.variables === report.id}
                  report={report}
                />
              ))}
            </div>
          )}
        </QueryState>
        {reports.data?.meta && reports.data.meta.total > 0 && (
          <Pagination
            page={reports.data.meta.page}
            total={reports.data.meta.total}
            totalPages={reports.data.meta.totalPages}
            onPageChange={setPage}
          />
        )}
      </section>
    </div>
  );
}

function ReportRow({
  report,
  canApprove,
  pending,
  onApprove,
}: {
  report: LabReport;
  canApprove: boolean;
  pending: boolean;
  onApprove: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const blob = await downloadReport(report.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `demo-report-${report.order.orderNumber}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The report could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <article className="flex flex-wrap items-start justify-between gap-4 p-5">
      <div>
        <h2 className="font-semibold">{report.order.orderNumber}</h2>
        <p className="mt-1 text-sm">
          {report.order.patient.firstName} {report.order.patient.lastName} · {report.order.patient.patientCode}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {report.order.items.length} test(s) · {titleCase(report.status)}
          {report.approvedBy && ` · Approved by ${report.approvedBy.firstName} ${report.approvedBy.lastName}`}
        </p>
        {report.order.items.map((item) => (
          <div className="mt-3 text-xs text-muted-foreground" key={item.id}>
            <p className="font-medium text-foreground">{item.testNameSnapshot}</p>
            {item.result?.parameters.map((parameter) => (
              <p key={parameter.testParameter.name}>
                {parameter.testParameter.name}: {parameter.value} {parameter.unit ?? ""}
                {parameter.isAbnormal ? " · Outside illustrative range" : ""}
              </p>
            ))}
          </div>
        ))}
        {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {canApprove && report.status === "PENDING_APPROVAL" && (
          <Button disabled={pending} onClick={onApprove} size="sm">
            {pending ? "Approving…" : "Approve report"}
          </Button>
        )}
        {(report.status === "APPROVED" || report.status === "DELIVERED") && (
          <Button disabled={downloading} onClick={() => void download()} size="sm" variant="outline">
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </Button>
        )}
      </div>
    </article>
  );
}
