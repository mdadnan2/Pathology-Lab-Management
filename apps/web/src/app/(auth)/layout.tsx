import type { ReactNode } from "react";
import { Activity, Microscope } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="relative min-h-screen bg-muted/40">
      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1fr_420px] lg:px-12">
        <section className="hidden space-y-8 lg:block">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Microscope aria-hidden="true" size={25} />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">
                Pathology Lab
              </p>
              <p className="text-sm text-muted-foreground">
                Laboratory operations platform
              </p>
            </div>
          </div>
          <div className="max-w-xl space-y-5">
            <p className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm text-muted-foreground">
              <Activity aria-hidden="true" className="size-4 text-emerald-600" />
              A focused workspace for diagnostic labs
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              From patient registration to a verified report.
            </h1>
            <p className="max-w-lg text-lg leading-8 text-muted-foreground">
              Follow orders, samples, results, and billing through one
              connected laboratory workflow.
            </p>
          </div>
          <p className="max-w-lg text-xs leading-5 text-muted-foreground">
            Demonstration software with fictional patient, staff, pricing, and
            result data. Not for clinical use or diagnosis.
          </p>
        </section>
        <div className="w-full">{children}</div>
      </div>
    </main>
  );
}
