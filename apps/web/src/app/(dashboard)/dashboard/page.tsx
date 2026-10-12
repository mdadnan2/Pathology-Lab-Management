"use client";

import { Activity, FlaskConical, ShieldCheck, Users, ClipboardList, CheckCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";

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
