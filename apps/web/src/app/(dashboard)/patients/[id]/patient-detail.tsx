"use client";

import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared/query-state";
import { Pagination } from "@/components/shared/pagination";
import { ApiError, apiRequest } from "@/lib/api/client";
import { LabOrder, PAGE_SIZE, Patient } from "@/lib/api/laboratory";
import { formatCurrency, formatDate, formatDateTime, titleCase } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PatientDetail({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [historyPage, setHistoryPage] = useState(1);
  const patient = useQuery({
    queryKey: ["patients", patientId],
    queryFn: async () =>
      (await apiRequest<Patient>(`/patients/${patientId}`)).data,
  });
  const history = useQuery({
    queryKey: ["patients", patientId, "orders"],
    queryFn: async () =>
      (await apiRequest<LabOrder[]>(`/patients/${patientId}/orders`)).data,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <Button onClick={() => router.back()} size="sm" variant="ghost">
        <ArrowLeft aria-hidden="true" />
        Back to patients
      </Button>
      <QueryState
        error={patient.error}
        loading={patient.isPending}
        onRetry={() => void patient.refetch()}
      >
        {patient.data && (
          <>
            <header className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Patient record · {patient.data.patientCode}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                {patient.data.firstName} {patient.data.lastName}
              </h1>
            </header>
            <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="Phone" value={patient.data.phone} />
              <Detail label="Email" value={patient.data.email ?? "Not provided"} />
              <Detail label="Date of birth" value={formatDate(patient.data.dateOfBirth)} />
              <Detail label="Gender" value={titleCase(patient.data.gender)} />
              <Detail
                label="Address"
                value={patient.data.address ?? "Not provided"}
              />
              <Detail
                label="Blood group"
                value={patient.data.bloodGroup ? titleCase(patient.data.bloodGroup) : "Not provided"}
              />
            </section>
          </>
        )}
      </QueryState>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-5">
          <ClipboardList aria-hidden="true" className="size-5 text-muted-foreground" />
          <h2 className="font-semibold">Order history</h2>
        </div>
        <QueryState
          error={history.error}
          loading={history.isPending}
          onRetry={() => void history.refetch()}
        >
          {!history.data?.length ? (
            <p className="p-7 text-center text-sm text-muted-foreground">
              No orders are recorded for this patient.
            </p>
          ) : (
            <div className="divide-y">
              {history.data.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE).map((order) => (
                <Link
                  className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-muted/30"
                  href={`/orders/${order.id}`}
                  key={order.id}
                >
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(order.createdAt)} · {order.items.length} tests
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {order.invoice
                        ? formatCurrency(order.invoice.totalAmount)
                        : "Invoice pending"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {titleCase(order.status)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </QueryState>
        {!!history.data?.length && (
          <Pagination
            page={historyPage}
            total={history.data.length}
            totalPages={Math.ceil(history.data.length / PAGE_SIZE)}
            onPageChange={setHistoryPage}
          />
        )}
      </section>
      {patient.error instanceof ApiError && patient.error.statusCode === 404 && (
        <p className="text-sm text-destructive" role="alert">Patient record not found.</p>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
