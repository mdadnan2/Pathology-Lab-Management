import { ChangePasswordForm } from "./change-password-form";

export default function ChangePasswordPage() {
  return (
    <section className="rounded-2xl border bg-card p-7 shadow-sm sm:p-9">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Account security
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Set a new password
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          A password update is required before you can use the staff workspace.
        </p>
      </div>
      <ChangePasswordForm />
    </section>
  );
}
