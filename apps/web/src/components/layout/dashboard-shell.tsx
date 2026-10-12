"use client";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ApiError, apiRequest } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ClipboardCheck, ClipboardList, FileCheck2, LayoutDashboard, LogOut, Microscope, Receipt, TestTube, UsersRound, UserRound, FlaskConical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    retry: false,
  });
  const logout = useMutation({
    mutationFn: () => apiRequest<null>("/auth/logout", { method: "POST" }),
    onSuccess: async () => {
      await queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });

  useEffect(() => {
    if (profile.data?.mustChangePassword) {
      router.replace("/change-password");
      return;
    }
    if (profile.error instanceof ApiError && profile.error.statusCode === 401) {
      router.replace("/login");
    }
  }, [profile.data?.mustChangePassword, profile.error, router]);

  if (profile.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking your staff session…
      </main>
    );
  }

  if (profile.isError) {
    if (profile.error instanceof ApiError && profile.error.statusCode === 401) {
      return (
        <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Redirecting to sign in…
        </main>
      );
    }

    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold">Could not verify your session</h1>
        <p className="text-sm text-muted-foreground">
          The lab service did not confirm your account. Check the API connection
          and try again.
        </p>
        <Button onClick={() => void profile.refetch()} variant="outline">
          Retry
        </Button>
      </main>
    );
  }

  if (profile.data.mustChangePassword) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Redirecting to password update…
      </main>
    );
  }

  const canManageStaff =
    profile.data.role === "OWNER" || profile.data.role === "ADMIN";
  const canViewResults = ["OWNER", "ADMIN", "TECHNICIAN", "PATHOLOGIST"].includes(profile.data.role);
  const canViewReports = ["OWNER", "ADMIN", "RECEPTIONIST", "PATHOLOGIST"].includes(profile.data.role);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Microscope aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-5">
                Pathology Lab
              </p>
              <p className="text-xs text-muted-foreground">Demo workspace</p>
            </div>
            <span className="ml-3 hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
              <Activity aria-hidden="true" className="size-3.5 text-emerald-600" />
              Operational
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">
                {profile.data.firstName} {profile.data.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {profile.data?.role?.replaceAll("_", " ").toLowerCase() ?? ""}
              </p>
            </div>
            <ThemeToggle />
            <Button
              aria-label="Sign out"
              disabled={logout.isPending}
              onClick={() => setConfirmSignOut(true)}
              size="sm"
              variant="outline"
            >
              <LogOut aria-hidden="true" />
              <span className="hidden sm:inline">
                {logout.isPending ? "Signing out…" : "Sign out"}
              </span>
            </Button>
          </div>
        </div>
      </header>
      {logout.isError && (
        <p className="border-b border-destructive/30 bg-destructive/5 px-5 py-2 text-center text-sm text-destructive">
          {logout.error.message || "Unable to sign out. Please try again."}
        </p>
      )}
      <ConfirmationDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out?"
        description={
          logout.isError
            ? `Sign out failed: ${logout.error.message}. You can try again.`
            : "Are you sure you want to sign out of your lab workspace?"
        }
        confirmLabel="Sign out"
        onConfirm={() => logout.mutate()}
        isPending={logout.isPending}
        destructive
      />
      <nav
        aria-label="Main navigation"
        className="flex gap-1 overflow-x-auto border-b bg-background px-5 py-2 lg:hidden"
      >
        <Link
          className="rounded-lg bg-muted px-3 py-2 text-sm font-medium"
          href="/dashboard"
        >
          Overview
        </Link>
        <Link className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground" href="/patients"><UserRound aria-hidden="true" className="mr-1 inline size-4" />Patients</Link>
        <Link className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground" href="/test-catalogue"><TestTube aria-hidden="true" className="mr-1 inline size-4" />Catalogue</Link>
        <Link className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground" href="/orders"><ClipboardList aria-hidden="true" className="mr-1 inline size-4" />Orders</Link>
        <Link className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground" href="/samples"><FlaskConical aria-hidden="true" className="mr-1 inline size-4" />Samples</Link>
        {canViewResults && <Link className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground" href="/results"><ClipboardCheck aria-hidden="true" className="mr-1 inline size-4" />Results</Link>}
        {canViewReports && <Link className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground" href="/reports"><FileCheck2 aria-hidden="true" className="mr-1 inline size-4" />Reports</Link>}
        <Link className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground" href="/billing"><Receipt aria-hidden="true" className="mr-1 inline size-4" />Billing</Link>
        {canManageStaff && (
          <Link
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground"
            href="/staff"
          >
            Staff &amp; roles
          </Link>
        )}
      </nav>
      <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r bg-background px-4 py-6 lg:block">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Workspace
          </p>
          <nav aria-label="Main navigation" className="space-y-1">
            <Link
              className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm font-medium"
              href="/dashboard"
            >
              <LayoutDashboard aria-hidden="true" className="size-4" />
              Overview
            </Link>
            <Link className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground" href="/patients">
              <UserRound aria-hidden="true" className="size-4" />
              Patients
            </Link>
            <Link className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground" href="/test-catalogue">
              <TestTube aria-hidden="true" className="size-4" />
              Test catalogue
            </Link>
            <Link className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground" href="/orders">
              <ClipboardList aria-hidden="true" className="size-4" />
              Test orders
            </Link>
            <Link className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground" href="/samples">
              <FlaskConical aria-hidden="true" className="size-4" />
              Samples
            </Link>
            {canViewResults && <Link className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground" href="/results"><ClipboardCheck aria-hidden="true" className="size-4" />Results</Link>}
            {canViewReports && <Link className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground" href="/reports"><FileCheck2 aria-hidden="true" className="size-4" />Reports</Link>}
            <Link className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground" href="/billing">
              <Receipt aria-hidden="true" className="size-4" />
              Billing
            </Link>
            {canManageStaff && (
              <Link
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                href="/staff"
              >
                <UsersRound aria-hidden="true" className="size-4" />
                Staff &amp; roles
              </Link>
            )}
          </nav>
          <p className="mt-8 px-3 text-xs leading-5 text-muted-foreground">
            Fictional demonstration data only. Not for clinical use.
          </p>
        </aside>
        <div className="flex min-w-0 flex-col">
          <main className="flex-1 px-5 py-8 sm:px-8">{children}</main>
          <footer className="px-5 pb-6 text-center text-xs text-muted-foreground sm:px-8">
            Fictional demonstration data only · Not for clinical use
          </footer>
        </div>
      </div>
    </div>
  );
}
