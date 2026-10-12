"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8, "Enter your current password."),
    newPassword: z.string().min(12, "Use at least 12 characters."),
    confirmPassword: z.string().min(12, "Confirm your new password."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const changePassword = useMutation({
    mutationFn: (values: ChangePasswordValues) =>
      apiRequest<{ message: string }>("/auth/change-password", {
        method: "POST",
        data: {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      router.replace("/dashboard");
      router.refresh();
    },
  });

  function onSubmit(values: ChangePasswordValues) {
    changePassword.mutate(values);
  }

  const fields = [
    {
      name: "currentPassword" as const,
      label: "Current or temporary password",
      autoComplete: "current-password",
    },
    {
      name: "newPassword" as const,
      label: "New password",
      autoComplete: "new-password",
    },
    {
      name: "confirmPassword" as const,
      label: "Confirm new password",
      autoComplete: "new-password",
    },
  ];

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      {fields.map(({ name, label, autoComplete }) => {
        const error = form.formState.errors[name];
        const errorId = `${name}-error`;
        return (
          <div className="space-y-2" key={name}>
            <label className="text-sm font-medium" htmlFor={name}>
              {label}
            </label>
            <input
              autoComplete={autoComplete}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={Boolean(error)}
              className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              id={name}
              type="password"
              {...form.register(name)}
            />
            {error?.message && (
              <p className="text-sm text-destructive" id={errorId} role="alert">
                {error.message}
              </p>
            )}
          </div>
        );
      })}
      {changePassword.isError && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {changePassword.error.message}
        </p>
      )}
      <Button
        className="h-11 w-full"
        disabled={changePassword.isPending}
        type="submit"
      >
        {changePassword.isPending ? "Updating password…" : "Update password"}
      </Button>
    </form>
  );
}
