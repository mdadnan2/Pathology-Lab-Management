"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { ApiError, apiPageRequest, apiRequest } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/auth";
import { PAGE_SIZE } from "@/lib/api/laboratory";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const STAFF_ROLES = [
  "OWNER",
  "ADMIN",
  "RECEPTIONIST",
  "TECHNICIAN",
  "PATHOLOGIST",
] as const;

type StaffRole = (typeof STAFF_ROLES)[number];

interface StaffMember {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: StaffRole;
  isActive: boolean;
}

type StaffAction =
  | { type: "deactivate"; user: StaffMember }
  | { type: "reset-password"; user: StaffMember };

const createStaffSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name."),
  lastName: z.string().trim().min(1, "Enter a last name."),
  email: z.string().email("Enter a valid email address."),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number."),
  password: z.string().min(12, "Use at least 12 characters."),
  role: z.enum(STAFF_ROLES),
});

type CreateStaffValues = z.infer<typeof createStaffSchema>;

function roleLabel(role: StaffRole): string {
  return role.replaceAll("_", " ").toLowerCase();
}

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [pendingAction, setPendingAction] = useState<StaffAction | null>(null);
  const [temporaryCredential, setTemporaryCredential] = useState<{
    name: string;
    password: string;
  }>();
  const currentUser = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    retry: false,
  });
  const staff = useQuery({
    queryKey: ["users", page, search],
    queryFn: async () => {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      return apiPageRequest<StaffMember>(`/users?${query}`);
    },
    retry: false,
  });
  const form = useForm<CreateStaffValues>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      role: "RECEPTIONIST",
    },
  });
  const createStaff = useMutation({
    mutationFn: (values: CreateStaffValues) =>
      apiRequest<StaffMember>("/users", { method: "POST", data: values }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"], exact: false });
      form.reset();
      setShowForm(false);
    },
  });
  const deactivateStaff = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ message: string }>(`/users/${id}/deactivate`, {
        method: "PATCH",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"], exact: false });
      setPendingAction(null);
    },
  });
  const resetStaffPassword = useMutation({
    mutationFn: async (user: StaffMember) => ({
      user,
      response: await apiRequest<{ temporaryPassword: string }>(
        `/users/${user.id}/password`,
        { method: "PATCH" },
      ),
    }),
    onSuccess: ({ user, response }) => {
      setTemporaryCredential({
        name: `${user.firstName} ${user.lastName}`,
        password: response.data.temporaryPassword,
      });
      setPendingAction(null);
    },
  });

  const isAdmin =
    currentUser.data?.role === "OWNER" || currentUser.data?.role === "ADMIN";
  function canManageStaffMember(user: StaffMember): boolean {
    if (currentUser.data?.role === "OWNER") return true;
    return (
      currentUser.data?.role === "ADMIN" &&
      ["RECEPTIONIST", "TECHNICIAN", "PATHOLOGIST"].includes(user.role)
    );
  }
  const roleChoices =
    currentUser.data?.role === "OWNER"
      ? STAFF_ROLES
      : STAFF_ROLES.filter((role) => role !== "OWNER" && role !== "ADMIN");

  function onCreate(values: CreateStaffValues) {
    createStaff.mutate(values);
  }

  function deactivate(user: StaffMember) {
    setPendingAction({ type: "deactivate", user });
  }

  function resetPassword(user: StaffMember) {
    setPendingAction({ type: "reset-password", user });
  }

  const isActionPending =
    (pendingAction?.type === "deactivate" && deactivateStaff.isPending) ||
    (pendingAction?.type === "reset-password" && resetStaffPassword.isPending);

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <ConfirmationDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !isActionPending) setPendingAction(null);
        }}
        title={pendingAction?.type === "deactivate" ? "Deactivate staff account?" : "Reset staff password?"}
        description={
          pendingAction?.type === "deactivate" && deactivateStaff.isError
            ? `Could not deactivate this account: ${deactivateStaff.error.message}`
            : pendingAction?.type === "reset-password" && resetStaffPassword.isError
              ? `Could not reset this password: ${resetStaffPassword.error.message}`
              : pendingAction?.type === "deactivate"
                ? `${pendingAction.user.firstName} ${pendingAction.user.lastName} will no longer be able to sign in.`
                : `A temporary password will be issued for ${pendingAction?.user.firstName ?? "this staff member"}. They will need to change it at their next sign-in.`
        }
        confirmLabel={pendingAction?.type === "deactivate" ? "Deactivate account" : "Reset password"}
        onConfirm={() => {
          if (pendingAction?.type === "deactivate") {
            deactivateStaff.mutate(pendingAction.user.id);
          } else if (pendingAction?.type === "reset-password") {
            resetStaffPassword.mutate(pendingAction.user);
          }
        }}
        isPending={isActionPending}
        destructive
      />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Administration
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Staff &amp; roles
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage fictional staff accounts and their laboratory roles.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm((visible) => !visible)}>
            <UserPlus aria-hidden="true" />
            {showForm ? "Close form" : "Add staff"}
          </Button>
        )}
      </header>

      {showForm && isAdmin && (
        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="mb-5 font-semibold">Create staff account</h2>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={form.handleSubmit(onCreate)}
            noValidate
          >
            <FormField label="First name" name="firstName" form={form} />
            <FormField label="Last name" name="lastName" form={form} />
            <FormField label="Email" name="email" form={form} type="email" />
            <FormField label="Mobile number" name="phone" form={form} />
            <FormField
              label="Initial password (change required at first sign-in)"
              name="password"
              form={form}
              type="password"
            />
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="role">
                Role
              </label>
              <select
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                id="role"
                {...form.register("role")}
              >
                {roleChoices.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
              <Button disabled={createStaff.isPending} type="submit">
                {createStaff.isPending ? "Creating…" : "Create account"}
              </Button>
              {createStaff.isError && (
                <p className="text-sm text-destructive" role="alert">
                  {createStaff.error.message}
                </p>
              )}
            </div>
          </form>
        </section>
      )}

      {temporaryCredential && (
        <section
          aria-label="One-time temporary password"
          className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          role="status"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="font-semibold">
                Temporary password for {temporaryCredential.name}
              </h2>
              <code className="block rounded-md border border-amber-300 bg-white px-3 py-2 font-mono text-sm dark:border-amber-800 dark:bg-background dark:text-foreground">
                {temporaryCredential.password}
              </code>
              <p className="text-sm">
                This password is shown once. Share it through a secure channel;
                the staff member must change it at sign-in.
              </p>
            </div>
            <Button
              onClick={() => {
                setTemporaryCredential(undefined);
                resetStaffPassword.reset();
              }}
              size="sm"
              variant="outline"
            >
              Dismiss
            </Button>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4 sm:px-5">
          <h2 className="font-semibold">Staff accounts</h2>
          <label className="relative block w-full sm:w-72">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <span className="sr-only">Search staff</span>
            <input
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Search name, email, or code"
              value={search}
            />
          </label>
        </div>

        {staff.isPending ? (
          <p className="p-6 text-sm text-muted-foreground" role="status">
            Loading staff accounts…
          </p>
        ) : staff.isError ? (
          <p className="p-6 text-sm text-destructive" role="alert">
            {staff.error instanceof ApiError && staff.error.statusCode === 403
              ? "You are not authorized to view staff accounts."
              : `Could not load staff accounts: ${staff.error.message}`}
          </p>
        ) : !staff.data?.data?.length ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No staff accounts match this search.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Staff member</th>
                    <th className="px-5 py-3 font-medium">Employee code</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    {isAdmin && (
                      <th className="px-5 py-3 text-right font-medium">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staff.data?.data?.map((user) => (
                    <tr key={user.id}>
                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">
                        {user.employeeCode}
                      </td>
                      <td className="px-5 py-4 capitalize">
                        {roleLabel(user.role)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={
                            user.isActive
                              ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {canManageStaffMember(user) && (
                              <Button
                                disabled={resetStaffPassword.isPending}
                                onClick={() => resetPassword(user)}
                                size="sm"
                                variant="outline"
                              >
                                Reset password
                              </Button>
                            )}
                            {user.isActive &&
                              canManageStaffMember(user) &&
                              user.id !== currentUser.data?.id && (
                                <Button
                                  disabled={deactivateStaff.isPending}
                                  onClick={() => deactivate(user)}
                                  size="sm"
                                  variant="outline"
                                >
                                  Deactivate
                                </Button>
                              )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
              <span className="text-muted-foreground">
                Page {staff.data.meta.page} of {Math.max(staff.data.meta.totalPages, 1)} ·{" "}
                {staff.data.meta.total} staff
              </span>
              <div className="flex gap-2">
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  size="sm"
                  variant="outline"
                >
                  Previous
                </Button>
                <Button
                  disabled={page >= staff.data.meta.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  size="sm"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
        {deactivateStaff.isError && (
          <p className="border-t px-5 py-3 text-sm text-destructive" role="alert">
            Could not deactivate account: {deactivateStaff.error.message}
          </p>
        )}
        {resetStaffPassword.isError && (
          <p className="border-t px-5 py-3 text-sm text-destructive" role="alert">
            Could not reset password: {resetStaffPassword.error.message}
          </p>
        )}
      </section>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  name: "firstName" | "lastName" | "email" | "phone" | "password";
  form: ReturnType<typeof useForm<CreateStaffValues>>;
  type?: string;
}

function FormField({ label, name, form, type = "text" }: FormFieldProps) {
  const error = form.formState.errors[name];
  const errorId = `${name}-error`;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <input
        autoComplete={
          name === "password"
            ? "new-password"
            : name === "email"
              ? "email"
              : "off"
        }
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        id={name}
        type={type}
        {...form.register(name)}
      />
      {error?.message && (
        <p className="text-xs text-destructive" id={errorId} role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}
