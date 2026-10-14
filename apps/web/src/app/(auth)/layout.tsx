import type { ReactNode } from "react";
import { Activity, Microscope } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="relative h-dvh overflow-hidden bg-muted/40">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="mx-auto grid h-full w-full max-w-5xl grid-cols-1 grid-rows-[auto_minmax(0,1fr)] items-center gap-4 px-4 pb-4 pt-16 sm:px-6 sm:pb-6 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] lg:grid-rows-1 lg:gap-8 lg:px-10 lg:py-8">
        <div className="flex items-center gap-3 lg:hidden">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Microscope aria-hidden="true" size={22} />
          </span>
          <div>
            <p className="font-semibold tracking-tight">Pathology Lab</p>
            <p className="text-sm text-muted-foreground">
              Laboratory operations platform
            </p>
          </div>
        </div>
        <section className="hidden min-w-0 space-y-8 lg:block">
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
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">
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
        <div className="w-full max-w-[360px] justify-self-center lg:justify-self-end lg:mr-4">
          {children}
        </div>
      </div>
    </main>
  );
}
