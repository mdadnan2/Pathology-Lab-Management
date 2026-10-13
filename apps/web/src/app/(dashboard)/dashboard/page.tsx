"use client";

import { Activity, FlaskConical, Users, ClipboardList, CheckCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";

interface DashboardStats {
  totalPatients: number;
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  pendingSamples: number;
  collectedSamples: number;
  totalTests: number;
  activeCategories: number;
}

export default function DashboardPage() {
  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => (await apiRequest<DashboardStats>("/dashboard")).data,
    retry: false,
  });

  const health = useQuery({
    queryKey: ["dashboard-health"],
    queryFn: async () => (await apiRequest<{ status?: string; database?: string }>("/health")).data,
    retry: false,
  });

  const isConnected = health.data?.database === "connected" || health.data?.status === "ok";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Laboratory overview
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome to your lab workspace
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Real-time statistics and operational summaries from your laboratory.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-600/20 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200">
        <span className="inline-flex items-center gap-2 font-medium">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden="true" />
          {isConnected ? "Connected" : "Unavailable"}
        </span>
        <span>Fictional data only</span>
      </section>

      {stats.isError && (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          role="status"
        >
          The dashboard statistics failed to load. Confirm the backend is running and reachable.
        </div>
      )}

      {/* Key Metrics Cards */}
      <section
        aria-label="Key metrics"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          icon={<Users aria-hidden="true" className="size-5 text-blue-500" />}
          label="Total Patients"
          value={stats.data?.totalPatients ?? 0}
          loading={stats.isPending}
        />
        <StatCard
          icon={<ClipboardList aria-hidden="true" className="size-5 text-amber-500" />}
          label="Pending Orders"
          value={stats.data?.pendingOrders ?? 0}
          loading={stats.isPending}
        />
        <StatCard
          icon={<Clock aria-hidden="true" className="size-5 text-purple-500" />}
          label="Processing Orders"
          value={stats.data?.processingOrders ?? 0}
          loading={stats.isPending}
        />
        <StatCard
          icon={<CheckCircle aria-hidden="true" className="size-5 text-green-500" />}
          label="Completed Orders"
          value={stats.data?.completedOrders ?? 0}
          loading={stats.isPending}
        />
      </section>

      {/* Additional Stats */}
      <section
        aria-label="Additional statistics"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          icon={<Clock aria-hidden="true" className="size-5 text-orange-500" />}
          label="Pending Samples"
          value={stats.data?.pendingSamples ?? 0}
          loading={stats.isPending}
        />
        <StatCard
          icon={<CheckCircle aria-hidden="true" className="size-5 text-teal-500" />}
          label="Collected Samples"
          value={stats.data?.collectedSamples ?? 0}
          loading={stats.isPending}
        />
        <StatCard
          icon={<FlaskConical aria-hidden="true" className="size-5 text-indigo-500" />}
          label="Total Tests"
          value={stats.data?.totalTests ?? 0}
          loading={stats.isPending}
        />
        <StatCard
          icon={<Activity aria-hidden="true" className="size-5 text-pink-500" />}
          label="Active Categories"
          value={stats.data?.activeCategories ?? 0}
          loading={stats.isPending}
        />
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Not for clinical use</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          This demonstration does not provide medical advice and must not be
          used to guide diagnosis or treatment. All patient and result examples
          are fictional.
        </p>
      </section>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
}

function StatCard({ icon, label, value, loading }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-4 text-3xl font-semibold">
        {loading ? (
          <span className="h-8 w-20 animate-pulse rounded bg-muted" />
        ) : (
          value
        )}
      </p>
    </div>
  );
}
