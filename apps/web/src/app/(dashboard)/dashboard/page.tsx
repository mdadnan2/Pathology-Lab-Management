"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle, Clock, ClipboardCheck, ClipboardList, FlaskConical, Users } from "lucide-react";
import { getCurrentUser, type StaffRole } from "@/lib/api/auth";
import { ApiError, apiRequest } from "@/lib/api/client";

interface DashboardStats {
  totalPatients?: number;
  pendingOrders?: number;
  processingOrders?: number;
  completedOrders?: number;
  pendingSamples?: number;
  collectedSamples?: number;
  processingSamples?: number;
  totalTests?: number;
  activeCategories?: number;
  resultsAwaitingReview?: number;
  reportsAwaitingApproval?: number;
}

type Metric = { label: string; key: keyof DashboardStats; icon: typeof Users };

const METRICS: Record<StaffRole, Metric[]> = {
  OWNER: [
    { label: "Total patients", key: "totalPatients", icon: Users },
    { label: "Pending orders", key: "pendingOrders", icon: ClipboardList },
    { label: "Processing orders", key: "processingOrders", icon: Clock },
    { label: "Completed orders", key: "completedOrders", icon: CheckCircle },
    { label: "Pending samples", key: "pendingSamples", icon: FlaskConical },
    { label: "Collected samples", key: "collectedSamples", icon: CheckCircle },
    { label: "Active tests", key: "totalTests", icon: FlaskConical },
    { label: "Test categories", key: "activeCategories", icon: Activity },
  ],
  ADMIN: [
    { label: "Total patients", key: "totalPatients", icon: Users },
    { label: "Pending orders", key: "pendingOrders", icon: ClipboardList },
    { label: "Processing orders", key: "processingOrders", icon: Clock },
    { label: "Completed orders", key: "completedOrders", icon: CheckCircle },
    { label: "Pending samples", key: "pendingSamples", icon: FlaskConical },
    { label: "Collected samples", key: "collectedSamples", icon: CheckCircle },
    { label: "Active tests", key: "totalTests", icon: FlaskConical },
    { label: "Test categories", key: "activeCategories", icon: Activity },
  ],
  RECEPTIONIST: [
    { label: "Total patients", key: "totalPatients", icon: Users },
    { label: "Pending orders", key: "pendingOrders", icon: ClipboardList },
    { label: "Pending samples", key: "pendingSamples", icon: FlaskConical },
  ],
  TECHNICIAN: [
    { label: "Pending samples", key: "pendingSamples", icon: FlaskConical },
    { label: "Collected samples", key: "collectedSamples", icon: CheckCircle },
    { label: "Processing samples", key: "processingSamples", icon: Clock },
    { label: "Processing orders", key: "processingOrders", icon: ClipboardList },
  ],
  PATHOLOGIST: [
    { label: "Results awaiting review", key: "resultsAwaitingReview", icon: ClipboardCheck },
    { label: "Reports awaiting approval", key: "reportsAwaitingApproval", icon: Clock },
    { label: "Completed orders", key: "completedOrders", icon: CheckCircle },
  ],
};

export default function DashboardPage() {
  const profile = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentUser, retry: false });
  const stats = useQuery({
    queryKey: ["dashboard-stats", profile.data?.role],
    queryFn: async () => (await apiRequest<DashboardStats>("/dashboard")).data,
    enabled: !!profile.data,
    retry: false,
  });
  const role = profile.data?.role;
  const metrics = role ? METRICS[role] : [];
  const roleLabel = role?.replaceAll("_", " ").toLowerCase();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium capitalize text-muted-foreground">{roleLabel ? `${roleLabel} overview` : "Laboratory overview"}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to your lab workspace</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">A role-appropriate view of your laboratory work.</p>
      </header>

      {stats.isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
          {stats.error instanceof ApiError && stats.error.statusCode === 403
            ? "Your account does not have permission to view these dashboard statistics."
            : stats.error instanceof ApiError && stats.error.statusCode === 0
              ? "The dashboard could not reach the lab service. Check the connection and retry."
              : `Dashboard statistics could not be loaded: ${stats.error.message}`}
          <button className="ml-3 underline" onClick={() => void stats.refetch()} type="button">Retry</button>
        </div>
      )}

      <section aria-label="Key metrics" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map(({ key, label, icon: Icon }) => (
          <div className="rounded-xl border bg-card p-5" key={key}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon aria-hidden="true" className="size-5" />
              <span className="text-sm">{label}</span>
            </div>
            <p className="mt-4 text-3xl font-semibold">
              {profile.isPending || stats.isPending ? <span className="inline-block h-8 w-20 animate-pulse rounded bg-muted" /> : stats.data?.[key] ?? 0}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Not for clinical use</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          This demonstration does not provide medical advice and must not be used to guide diagnosis or treatment. All patient and result examples are fictional.
        </p>
      </section>
    </div>
  );
}
