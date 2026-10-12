"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared/query-state";
import { Pagination } from "@/components/shared/pagination";
import { createPatient, listPatients, type PatientCreateValues } from "@/lib/api/laboratory";
import { formatDate } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const patientSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name.").max(100),
  lastName: z.string().trim().min(1, "Enter a last name.").max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  email: z.union([z.literal(""), z.string().email("Enter a valid email.")]),
  dateOfBirth: z.string().min(1, "Enter date of birth."),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  address: z.string().max(500, "Address must be 500 characters or less."),
});

type PatientFormValues = z.infer<typeof patientSchema>;

export default function PatientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const patients = useQuery({
    queryKey: ["patients", page, search],
    queryFn: () => listPatients(page, search),
  });
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      dateOfBirth: "",
      gender: "FEMALE",
      address: "",
    },
  });
  const create = useMutation({
    mutationFn: (values: PatientFormValues) => {
      const { email, address, ...required } = values;
      const payload: PatientCreateValues = {
        ...required,
        ...(email ? { email } : {}),
        ...(address ? { address } : {}),
      };
      return createPatient(payload);
    },
    onSuccess: async (result) => {
      setDuplicateWarning(result?.meta?.duplicateWarning ?? false);
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
      form.reset();
      setShowForm(false);
    },
  });

  function submit(values: PatientFormValues) {
    setDuplicateWarning(false);
    create.mutate(values);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Patient records
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Patients</h1>
          <p className="text-sm text-muted-foreground">
            Search and register fictional demonstration patients.
          </p>
        </div>
        <Button
          onClick={() => setShowForm((current) => !current)}
          type="button"
        >
          <UserPlus aria-hidden="true" />
          {showForm ? "Close form" : "Register patient"}
        </Button>
      </header>

      {duplicateWarning && (
        <p
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          role="status"
        >
          A patient with the same phone number is already registered.
          The new record was saved; review the patient directory for possible
          duplicates.
        </p>
      )}
      {create.isError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
          Could not register patient: {create.error.message}
        </p>
      )}

      {showForm && (
        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="mb-5 font-semibold">Register a patient</h2>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={form.handleSubmit(submit)}
            noValidate
          >
            <Field form={form} label="First name" name="firstName" />
            <Field form={form} label="Last name" name="lastName" />
            <Field form={form} label="Mobile number" name="phone" />
            <Field form={form} label="Email (optional)" name="email" type="email" />
            <Field
              form={form}
              label="Date of birth"
              name="dateOfBirth"
              type="date"
            />
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="gender">
                Gender
              </label>
              <select
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                id="gender"
                {...form.register("gender")}
              >
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <label className="text-sm font-medium" htmlFor="address">
                Address (optional)
              </label>
              <textarea
                className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                id="address"
                {...form.register("address")}
              />
              {form.formState.errors.address?.message && (
                <p className="text-xs text-destructive" role="alert">
                  {form.formState.errors.address.message}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
              <Button disabled={create.isPending} type="submit">
                {create.isPending ? "Registering…" : "Save patient"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Patient identifiers are generated by the server.
              </p>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4 sm:px-5">
          <h2 className="font-semibold">Patient directory</h2>
          <label className="relative block w-full sm:w-80">
            <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <span className="sr-only">Search patients</span>
            <input
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Name, phone, or patient ID"
              value={search}
            />
          </label>
        </div>
        <QueryState
          error={patients.error}
          loading={patients.isPending}
          onRetry={() => void patients.refetch()}
        >
          {!patients.data?.data?.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No patient records found. Register a fictional patient to begin.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Patient</th>
                      <th className="px-5 py-3 font-medium">Patient ID</th>
                      <th className="px-5 py-3 font-medium">Phone</th>
                      <th className="px-5 py-3 font-medium">Date of birth</th>
                      <th className="px-5 py-3 font-medium">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {patients.data?.data?.map((patient) => (
                      <tr className="hover:bg-muted/30" key={patient.id}>
                        <td className="px-5 py-4 font-medium">
                          <Link
                            className="hover:underline"
                            href={`/patients/${patient.id}`}
                          >
                            {patient.firstName} {patient.lastName}
                          </Link>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs">
                          {patient.patientCode}
                        </td>
                        <td className="px-5 py-4">{patient.phone}</td>
                        <td className="px-5 py-4">{formatDate(patient.dateOfBirth)}</td>
                        <td className="px-5 py-4">{formatDate(patient.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {patients.data?.meta && (
                <Pagination
                  page={patients.data.meta.page}
                  total={patients.data.meta.total}
                  totalPages={patients.data.meta.totalPages}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </QueryState>
      </section>
    </div>
  );
}

interface FieldProps {
  form: ReturnType<typeof useForm<PatientFormValues>>;
  label: string;
  name: "firstName" | "lastName" | "phone" | "email" | "dateOfBirth";
  type?: string;
}

function Field({ form, label, name, type = "text" }: FieldProps) {
  const error = form.formState.errors[name];
  const errorId = `${name}-error`;
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={name}>{label}</label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
        id={name}
        type={type}
        {...form.register(name)}
      />
      {error?.message && <p className="text-xs text-destructive" id={errorId} role="alert">{error.message}</p>}
    </div>
  );
}
