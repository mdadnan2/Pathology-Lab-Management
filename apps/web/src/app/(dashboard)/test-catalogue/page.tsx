"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { QueryState } from "@/components/shared/query-state";
import { Pagination } from "@/components/shared/pagination";
import { apiRequest } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/auth";
import { listTestPackages, listTests, type LabTest, type TestCategory, type TestPackage } from "@/lib/api/laboratory";
import { formatCurrency } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Package, UserPlus } from "lucide-react";
import { useState } from "react";
import {
  useForm,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { z } from "zod";

const testSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(200),
  categoryId: z.string().uuid(),
  specimenType: z.string().trim().min(2),
  department: z.string().trim().min(2),
  price: z.coerce.number().positive(),
  turnaroundHours: z.coerce.number().int().positive(),
  description: z.string().max(1000),
});

const packageSchema = z.object({
  name: z.string().trim().min(2).max(200),
  price: z.coerce.number().positive(),
  description: z.string().max(1000),
  testIds: z.array(z.string()).min(1, "Select at least one test"),
});

const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(10),
});

type TestValues = z.output<typeof testSchema>;
type TestFormValues = z.input<typeof testSchema>;
type PackageValues = z.output<typeof packageSchema>;
type PackageFormValues = z.input<typeof packageSchema>;
type CategoryValues = z.output<typeof categorySchema>;
type CategoryFormValues = z.input<typeof categorySchema>;

export default function TestCataloguePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [testPage, setTestPage] = useState(1);
  const [packagePage, setPackagePage] = useState(1);
  const [categoryId, setCategoryId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [testToDeactivate, setTestToDeactivate] = useState<LabTest | null>(null);
  const [view, setView] = useState<"tests" | "packages">("tests");
  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
  });
  const tests = useQuery({
    queryKey: ["test-catalogue", testPage, search, categoryId, includeInactive],
    queryFn: () =>
      listTests({
        page: testPage,
        search,
        categoryId: categoryId || undefined,
        activeOnly: !includeInactive,
      }),
  });
  const categories = useQuery({
    queryKey: ["test-categories"],
    queryFn: async () =>
      (await apiRequest<TestCategory[]>("/test-catalogue/categories")).data,
  });
  const packages = useQuery({
    queryKey: ["test-packages", packagePage],
    queryFn: () => listTestPackages({ page: packagePage }),
    enabled: view === "packages",
  });
  const packageTests = useQuery({
    queryKey: ["test-catalogue", "package-form"],
    queryFn: () => listTests({ activeOnly: true, limit: 100 }),
    enabled: showForm && view === "packages",
  });
  const form = useForm<TestFormValues, unknown, TestValues>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      code: "",
      name: "",
      categoryId: "",
      specimenType: "",
      department: "",
      price: 0,
      turnaroundHours: 24,
      description: "",
    },
  });
  const categoryForm = useForm<CategoryFormValues, unknown, CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      code: "",
    },
  });
  const packageForm = useForm<PackageFormValues, unknown, PackageValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: "",
      price: 0,
      description: "",
      testIds: [],
    },
  });
  const create = useMutation({
    mutationFn: (values: TestValues) =>
      apiRequest<LabTest>("/test-catalogue", {
        method: "POST",
        data: {
          ...values,
          ...(values.description ? {} : { description: undefined }),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["test-catalogue"] });
      form.reset();
      setShowForm(false);
    },
  });
  const createPackage = useMutation({
    mutationFn: (values: PackageValues) =>
      apiRequest<TestPackage>("/test-packages", {
        method: "POST",
        data: {
          name: values.name,
          price: values.price.toString(),
          description: values.description || undefined,
          testIds: values.testIds,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["test-packages"] });
      packageForm.reset();
      setShowForm(false);
    },
  });
  const createCategory = useMutation({
    mutationFn: (values: CategoryValues) =>
      apiRequest<TestCategory>("/test-catalogue/categories", {
        method: "POST",
        data: values,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["test-categories"] });
      categoryForm.reset();
      setShowCategoryForm(false);
    },
  });
  const toggle = useMutation({
    mutationFn: (test: LabTest) =>
      apiRequest<LabTest>(`/test-catalogue/${test.id}/toggle`, {
        method: "PATCH",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["test-catalogue"] });
      setTestToDeactivate(null);
    },
  });
  const canManage = me.data?.role === "OWNER" || me.data?.role === "ADMIN" || me.data?.role === "RECEPTIONIST";

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <ConfirmationDialog
        open={testToDeactivate !== null}
        onOpenChange={(open) => {
          if (!open && !toggle.isPending) setTestToDeactivate(null);
        }}
        title="Deactivate catalogue test?"
        description={
          toggle.isError
            ? `Could not deactivate test: ${toggle.error.message}`
            : `${testToDeactivate?.name ?? "This test"} will no longer be available for new orders.`
        }
        confirmLabel="Deactivate test"
        onConfirm={() => {
          if (testToDeactivate) toggle.mutate(testToDeactivate);
        }}
        isPending={toggle.isPending}
        destructive
      />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Diagnostic services</p>
          <h1 className="text-3xl font-semibold tracking-tight">Test catalogue</h1>
          <p className="text-sm text-muted-foreground">
            Illustrative demonstration services and prices only.
          </p>
        </div>
        <div className="flex gap-2">
          {me.isPending && (
            <p className="self-center text-sm text-muted-foreground" role="status">
              Checking permissions…
            </p>
          )}
          {me.isError && (
            <Button onClick={() => void me.refetch()} variant="outline">
              Retry role check
            </Button>
          )}
          {canManage && (
            <Button variant="outline" onClick={() => setShowCategoryForm((visible) => !visible)}>
              {showCategoryForm ? "Close form" : "Add category"}
            </Button>
          )}
          {canManage && (
            <Button variant="outline" onClick={() => setShowForm((visible) => !visible)}>
              {showForm ? "Close form" : view === "tests" ? (
                <>
                  <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
                  Add test
                </>
              ) : (
                <>
                  <Package aria-hidden="true" className="mr-2 h-4 w-4" />
                  Add package
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      <div className="flex gap-2 border-b">
        <button
          className={`border-b-2 px-3 py-2 text-sm ${view === "tests" ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}
          onClick={() => setView("tests")}
          type="button"
        >
          Individual tests
        </button>
        <button
          className={`border-b-2 px-3 py-2 text-sm ${view === "packages" ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}
          onClick={() => setView("packages")}
          type="button"
        >
          Test packages
        </button>
      </div>

      {showCategoryForm && canManage && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Create test category</h2>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={categoryForm.handleSubmit((values) => createCategory.mutate(values))}>
            <Input form={categoryForm} label="Category name" name="name" />
            <Input form={categoryForm} label="Category code" name="code" />
            <div className="flex items-center gap-3 lg:col-span-3">
              <Button disabled={createCategory.isPending} type="submit">{createCategory.isPending ? "Saving…" : "Save category"}</Button>
              {createCategory.isError && <p className="text-sm text-destructive" role="alert">{createCategory.error.message}</p>}
            </div>
          </form>
        </section>
      )}
      {showForm && canManage && (
        <section className="rounded-xl border bg-card p-5">
          {view === "tests" ? (
            <>
              <h2 className="mb-4 font-semibold">Create catalogue test</h2>
              <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
                <Input form={form} label="Test code" name="code" />
                <Input form={form} label="Test name" name="name" />
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="test-category">Category</label>
                  <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="test-category" {...form.register("categoryId")}>
                    <option value="">Select a category</option>
                    {categories.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  {form.formState.errors.categoryId?.message && <p className="text-xs text-destructive">{form.formState.errors.categoryId.message}</p>}
                </div>
                <Input form={form} label="Specimen type" name="specimenType" />
                <Input form={form} label="Department" name="department" />
                <Input form={form} label="Illustrative price (INR)" name="price" type="number" />
                <Input form={form} label="Turnaround (hours)" name="turnaroundHours" type="number" />
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium" htmlFor="test-description">Description</label>
                  <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="test-description" {...form.register("description")} />
                </div>
                <div className="flex items-center gap-3 lg:col-span-3">
                  <Button disabled={create.isPending} type="submit">{create.isPending ? "Saving…" : "Save test"}</Button>
                  {create.isError && <p className="text-sm text-destructive" role="alert">{create.error.message}</p>}
                </div>
              </form>
            </>
          ) : (
            <>
              <h2 className="mb-4 font-semibold">Create test package</h2>
              <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={packageForm.handleSubmit((values) => createPackage.mutate(values))}>
                <Input form={packageForm} label="Package name" name="name" />
                <Input form={packageForm} label="Illustrative price (INR)" name="price" type="number" />
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Select tests</label>
                  <div className="max-h-40 overflow-y-auto rounded-lg border">
                    {packageTests.isPending ? (
                      <p className="p-3 text-sm text-muted-foreground">Loading active tests…</p>
                    ) : packageTests.isError ? (
                      <p className="p-3 text-sm text-destructive" role="alert">Could not load active tests: {packageTests.error.message}</p>
                    ) : packageTests.data.data.map((test) => (
                        <label key={test.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={packageForm.watch("testIds").includes(test.id)}
                            onChange={(e) => {
                              const current = packageForm.getValues("testIds");
                              const updated = e.target.checked
                                ? [...current, test.id]
                                : current.filter((id) => id !== test.id);
                              packageForm.setValue("testIds", updated);
                            }}
                          />
                          <span className="text-sm">{test.code} - {test.name}</span>
                        </label>
                      ))}
                  </div>
                  {packageForm.formState.errors.testIds?.message && <p className="text-xs text-destructive">{packageForm.formState.errors.testIds.message}</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium" htmlFor="package-description">Description</label>
                  <textarea className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm" id="package-description" {...packageForm.register("description")} />
                </div>
                <div className="flex items-center gap-3 lg:col-span-3">
                  <Button disabled={createPackage.isPending} type="submit">{createPackage.isPending ? "Saving…" : "Save package"}</Button>
                  {createPackage.isError && <p className="text-sm text-destructive" role="alert">{createPackage.error.message}</p>}
                </div>
              </form>
            </>
          )}
        </section>
      )}

      {view === "tests" ? (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <label className="relative min-w-56 flex-1">
              <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <span className="sr-only">Search tests</span>
              <input className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm" onChange={(event) => { setSearch(event.target.value); setTestPage(1); }} placeholder="Search name or code" value={search} />
            </label>
            <label className="sr-only" htmlFor="category-filter">Filter by category</label>
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" id="category-filter" onChange={(event) => { setCategoryId(event.target.value); setTestPage(1); }} value={categoryId}>
              <option value="">All categories</option>
              {categories.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            {canManage && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input checked={includeInactive} onChange={(event) => { setIncludeInactive(event.target.checked); setTestPage(1); }} type="checkbox" />
                Include inactive
              </label>
            )}
          </div>
          <QueryState error={tests.error} loading={tests.isPending} onRetry={() => void tests.refetch()}>
            {!tests.data?.data?.length ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No catalogue tests found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Test</th><th className="px-5 py-3 font-medium">Category</th><th className="px-5 py-3 font-medium">Specimen</th><th className="px-5 py-3 font-medium">Turnaround</th><th className="px-5 py-3 font-medium">Demo price</th>{canManage && <th className="px-5 py-3 text-right font-medium">Status</th>}</tr></thead>
                  <tbody className="divide-y">
                    {tests.data.data.map((test) => (
                      <tr key={test.id}>
                        <td className="px-5 py-4"><p className="font-medium">{test.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{test.code}</p></td>
                        <td className="px-5 py-4">{test.category.name}</td>
                        <td className="px-5 py-4">{test.specimenType}</td>
                        <td className="px-5 py-4">{test.turnaroundHours} h</td>
                        <td className="px-5 py-4 font-medium">{formatCurrency(test.price)}</td>
                        {canManage && <td className="px-5 py-4 text-right"><Button disabled={toggle.isPending} onClick={() => test.isActive ? setTestToDeactivate(test) : toggle.mutate(test)} size="sm" variant="outline">{test.isActive ? "Deactivate" : "Activate"}</Button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryState>
          {tests.data?.meta && tests.data.meta.total > 0 && (
            <Pagination
              page={tests.data.meta.page}
              total={tests.data.meta.total}
              totalPages={tests.data.meta.totalPages}
              onPageChange={setTestPage}
            />
          )}
          {toggle.isError && <p className="border-t p-3 text-sm text-destructive" role="alert">{toggle.error.message}</p>}
          <p className="border-t px-5 py-3 text-xs text-muted-foreground">All displayed prices are illustrative demo values, not market prices.</p>
        </section>
      ) : (
        <QueryState error={packages.error} loading={packages.isPending} onRetry={() => void packages.refetch()}>
          {!packages.data?.data?.length ? (
            <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No active packages are available.</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {packages.data.data.map((pkg) => (
                  <article className="rounded-xl border bg-card p-5" key={pkg.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div><h2 className="font-semibold">{pkg.name}</h2><p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p></div>
                      <p className="shrink-0 font-semibold">{formatCurrency(pkg.price)}</p>
                    </div>
                    <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Included tests</p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {pkg.items.map(({ labTest }) => <li className="rounded-full bg-muted px-2.5 py-1 text-xs" key={labTest.id}>{labTest.code} · {labTest.name}</li>)}
                    </ul>
                  </article>
                ))}
              </div>
              <Pagination
                page={packages.data.meta.page}
                total={packages.data.meta.total}
                totalPages={packages.data.meta.totalPages}
                onPageChange={setPackagePage}
              />
            </>
          )}
        </QueryState>
      )}
    </div>
  );
}

function Input<
  TFieldValues extends FieldValues,
  TContext,
  TTransformedValues extends FieldValues | undefined,
>({
  form,
  label,
  name,
  type = "text",
}: {
  form: UseFormReturn<TFieldValues, TContext, TTransformedValues>;
  label: string;
  name: FieldPath<TFieldValues>;
  type?: string;
}) {
  const error = form.getFieldState(name).error;
  return <div className="space-y-2"><label className="text-sm font-medium" htmlFor={name}>{label}</label><input aria-invalid={Boolean(error)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id={name} type={type} {...form.register(name)} />{error?.message && <p className="text-xs text-destructive" role="alert">{error.message}</p>}</div>;
}
