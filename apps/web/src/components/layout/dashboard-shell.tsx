"use client";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ApiError, apiRequest } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ClipboardCheck, ClipboardList, FileCheck2, LayoutDashboard, LogOut, Microscope, Receipt, TestTube, UsersRound, UserRound, FlaskConical } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
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
    document.documentElement.classList.add("dashboard-scrollbars");
    return () => document.documentElement.classList.remove("dashboard-scrollbars");
  }, []);

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

  const navigationItems = [
    { href: "/dashboard", label: "Overview", permission: "dashboard.view", icon: LayoutDashboard },
    { href: "/patients", label: "Patients", permission: "patients.view", icon: UserRound },
    { href: "/test-catalogue", label: "Test catalogue", permission: "catalogue.view", icon: TestTube },
    { href: "/orders", label: "Test orders", permission: "orders.view", icon: ClipboardList },
    { href: "/samples", label: "Samples", permission: "samples.view", icon: FlaskConical },
    { href: "/results", label: "Results", permission: "results.view", icon: ClipboardCheck },
    { href: "/reports", label: "Reports", permission: "reports.view", icon: FileCheck2 },
    { href: "/billing", label: "Billing", permission: "billing.view", icon: Receipt },
    { href: "/staff", label: "Staff & roles", permission: "staff.manage", icon: UsersRound },
  ].filter((item) => profile.data.permissions.includes(item.permission));
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  const mobileLinkClass = (href: string) =>
    `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
      isActive(href)
        ? "bg-muted font-medium text-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;
  const sidebarLinkClass = (href: string) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
      isActive(href)
        ? "bg-muted font-medium text-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <div className="dashboard-shell min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-8">
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
        className="sticky top-14 z-30 flex gap-1 overflow-x-auto border-b bg-background px-5 py-1 lg:hidden"
      >
        {navigationItems.map(({ href, label, icon: Icon }) => (
          <Link
            aria-current={isActive(href) ? "page" : undefined}
            className={mobileLinkClass(href)}
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" className="mr-1 inline size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-7xl lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] self-start overflow-y-auto border-r bg-background px-4 py-6 lg:block">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Workspace
          </p>
          <nav aria-label="Main navigation" className="space-y-1">
            {navigationItems.map(({ href, label, icon: Icon }) => (
              <Link
                aria-current={isActive(href) ? "page" : undefined}
                className={sidebarLinkClass(href)}
                href={href}
                key={href}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            ))}
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
