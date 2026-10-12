import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <section className="rounded-2xl border bg-card p-7 shadow-sm sm:p-9">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Staff workspace
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Use your demo staff account to continue to the lab dashboard.
        </p>
      </div>
      <LoginForm />
    </section>
  );
}
