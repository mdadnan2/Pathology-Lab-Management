"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof loginSchema>;

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

export function LoginForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string>();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const login = useMutation({
    mutationFn: (values: LoginValues) =>
      apiRequest<UserProfile>("/auth/login", {
        method: "POST",
        data: values,
      }),
      onSuccess: (response) => {
        router.replace(
        response.data.mustChangePassword ? "/change-password" : "/dashboard",
      );
      router.refresh();
    },
    onError: (error: Error) => {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : "Unable to reach the lab service. Check the API and try again.",
      );
    },
  });

  function onSubmit(values: LoginValues) {
    setSubmitError(undefined);
    login.mutate(values);
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="email">
          Email address
        </label>
        <input
          autoComplete="username"
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          id="email"
          type="email"
          {...form.register("email")}
          aria-invalid={Boolean(form.formState.errors.email)}
          aria-describedby={form.formState.errors.email ? "email-error" : undefined}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive" id="email-error" role="alert">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          id="password"
          type="password"
          {...form.register("password")}
          aria-invalid={Boolean(form.formState.errors.password)}
          aria-describedby={
            form.formState.errors.password ? "password-error" : undefined
          }
        />
        {form.formState.errors.password && (
          <p
            className="text-sm text-destructive"
            id="password-error"
            role="alert"
          >
            {form.formState.errors.password.message}
          </p>
        )}
      </div>
      {submitError && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {submitError}
        </p>
      )}
      <Button className="h-10 w-full" disabled={login.isPending} type="submit">
        {login.isPending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        Demo environment only. Never enter real patient information.
      </p>
    </form>
  );
}
