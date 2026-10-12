import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authProfile: {
    id: "owner-1",
    firstName: "Demo",
    lastName: "Owner",
    email: "owner@example.test",
    role: "OWNER",
    mustChangePassword: false,
  },
  currentUserQuery: vi.fn(),
  apiRequest: vi.fn(),
  apiPageRequest: vi.fn(),
  listPatients: vi.fn(),
  createPatient: vi.fn(),
  listTests: vi.fn(),
  listTestPackages: vi.fn(),
  listOrders: vi.fn(),
  getOrder: vi.fn(),
  listSamples: vi.fn(),
  updateSampleStatus: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  useParams: vi.fn(),
}));

vi.mock("@/lib/api/client", () => {
  class ApiError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
    }
  }
  return {
    ApiError,
    apiRequest: mocks.apiRequest,
    apiPageRequest: mocks.apiPageRequest,
  };
});

vi.mock("@/lib/api/auth", () => ({
  getCurrentUser: mocks.currentUserQuery,
}));
vi.mock("@/lib/api/laboratory", () => ({
  PAGE_SIZE: 5,
  createPatient: mocks.createPatient,
  getOrder: mocks.getOrder,
  listOrders: mocks.listOrders,
  listPatients: mocks.listPatients,
  listSamples: mocks.listSamples,
  listTestPackages: mocks.listTestPackages,
  listTests: mocks.listTests,
  updateSampleStatus: mocks.updateSampleStatus,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, back: vi.fn() }),
  useParams: mocks.useParams,
}));

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QueryState } from "@/components/shared/query-state";
import { Pagination } from "@/components/shared/pagination";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ThemeProvider } from "@/providers/theme-provider";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { ChangePasswordForm } from "@/app/(auth)/change-password/change-password-form";
import DashboardPage from "@/app/(dashboard)/dashboard/page";
import OrderDetailPage from "@/app/(dashboard)/orders/[id]/page";
import OrdersPage from "@/app/(dashboard)/orders/page";
import PatientDetail from "@/app/(dashboard)/patients/[id]/patient-detail";
import PatientsPage from "@/app/(dashboard)/patients/page";
import SamplesPage from "@/app/(dashboard)/samples/page";
import StaffPage from "@/app/(dashboard)/staff/page";
import TestCataloguePage from "@/app/(dashboard)/test-catalogue/page";

const owner = mocks.authProfile;

const testPatient = {
  id: "patient-1",
  patientCode: "PAT-20261009-0001",
  firstName: "Aditi",
  lastName: "Nair",
  phone: "9123456780",
  email: null,
  dateOfBirth: "1990-05-15T00:00:00.000Z",
  gender: "FEMALE" as const,
  bloodGroup: null,
  address: null,
  createdAt: "2026-10-09T10:00:00.000Z",
};

const order = {
  id: "order-1",
  orderNumber: "ORD-20261009-0001",
  status: "NEW",
  notes: null,
  createdAt: "2026-10-09T10:00:00.000Z",
  patient: {
    id: testPatient.id,
    patientCode: testPatient.patientCode,
    firstName: testPatient.firstName,
    lastName: testPatient.lastName,
    phone: testPatient.phone,
  },
  items: [{
    id: "item-1",
    status: "PENDING",
    testNameSnapshot: "Demo blood test",
    priceSnapshot: "350.00",
    labTest: { code: "QA-CBC", name: "Demo blood test" },
  }],
  samples: [{ id: "sample-1", sampleId: "SMP-0001", status: "PENDING" as const }],
  invoice: {
    invoiceNumber: "INV-0001",
    totalAmount: "350.00",
    paidAmount: "0.00",
    status: "UNPAID",
  },
};

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

function paginated<T>(data: T[]) {
  return { data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1 } };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  mocks.currentUserQuery.mockResolvedValue(owner);
  mocks.apiRequest.mockImplementation(async (path: string) => {
    if (path === "/health") {
      return { data: { status: "ok", database: "connected", timestamp: "now" } };
    }
    if (path === "/test-catalogue/categories") return { data: [] };
    if (path === `/patients/${testPatient.id}`) return { data: testPatient };
    if (path === `/patients/${testPatient.id}/orders`) return { data: [order] };
    return { data: {} };
  });
  mocks.apiPageRequest.mockResolvedValue(paginated([
    { employeeCode: "EMP-001", ...owner, phone: "9000000001", isActive: true },
  ]));
  mocks.listPatients.mockResolvedValue(paginated([testPatient]));
  mocks.createPatient.mockResolvedValue({
    data: testPatient,
    meta: { duplicateWarning: false },
  });
  mocks.listTests.mockResolvedValue(paginated([
    {
      id: "test-1",
      code: "QA-CBC",
      name: "Demo blood test",
      categoryId: "category-1",
      category: { id: "category-1", code: "QA", name: "QA Demo" },
      specimenType: "Blood",
      department: "Hematology",
      price: "350.00",
      turnaroundHours: 24,
      isActive: true,
      description: null,
      parameters: [],
    },
  ]));
  mocks.listTestPackages.mockResolvedValue(paginated([]));
  mocks.listOrders.mockResolvedValue(paginated([order]));
  mocks.getOrder.mockResolvedValue(order);
  mocks.listSamples.mockResolvedValue(paginated([]));
  mocks.useParams.mockReturnValue({ id: order.id });
});

afterEach(() => cleanup());

describe("shared UI components", () => {
  it("toggles and persists the selected color theme", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ThemeToggle />);

    await user.click(await screen.findByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("pathology-lab-theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(window.localStorage.getItem("pathology-lab-theme")).toBe("light");
  });

  it("renders children after a query succeeds", () => {
    renderWithQuery(
      <QueryState loading={false} error={null} onRetry={vi.fn()}>
        <p>Loaded content</p>
      </QueryState>,
    );
    expect(screen.getByText("Loaded content")).toBeInTheDocument();
  });

  it("exposes a retry control when a query fails", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <QueryState loading={false} error={new Error("API unavailable")} onRetry={retry}>
        <p>Loaded content</p>
      </QueryState>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("API unavailable");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("renders pagination and disables previous at the first page", () => {
    renderWithQuery(<Pagination page={1} total={3} totalPages={2} onPageChange={vi.fn()} />);
    expect(screen.getByText("Page 1 of 2 · 3 records")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });
});

describe("authentication and dashboard screens", () => {
  it("renders login fields and blocks an empty submission", async () => {
    const user = userEvent.setup();
    renderWithQuery(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
  });

  it("renders password-change fields and validates mismatched passwords", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ChangePasswordForm />);
    await user.type(screen.getByLabelText("Current or temporary password"), "current-password");
    await user.type(screen.getByLabelText("New password"), "new-password-123");
    await user.type(screen.getByLabelText("Confirm new password"), "different-password");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("shows authenticated navigation for the owner", async () => {
    renderWithQuery(<DashboardShell><p>Protected page</p></DashboardShell>);
    expect((await screen.findAllByRole("navigation", { name: "Main navigation" })).length).toBe(2);
    expect(screen.getAllByRole("link", { name: /Staff & roles/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("Protected page")).toBeInTheDocument();
  });

  it("asks for confirmation before signing out", async () => {
    const user = userEvent.setup();
    renderWithQuery(<DashboardShell><p>Protected page</p></DashboardShell>);
    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("dialog", { name: "Sign out?" })).toBeInTheDocument();
    expect(mocks.apiRequest).not.toHaveBeenCalledWith("/auth/logout", expect.anything());

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Sign out?" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    const confirmation = await screen.findByRole("dialog", { name: "Sign out?" });
    await user.click(within(confirmation).getByRole("button", { name: "Sign out" }));
    expect(mocks.apiRequest).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
  });

  it("shows API health and demo notices on the dashboard", async () => {
    renderWithQuery(<DashboardPage />);
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Fictional data only")).toBeInTheDocument();
  });
});

describe("patient and staff screens", () => {
  it("renders patient directory records", async () => {
    renderWithQuery(<PatientsPage />);
    expect(await screen.findByText("Aditi Nair")).toBeInTheDocument();
    expect(screen.getByText(testPatient.patientCode)).toBeInTheDocument();
  });

  it("renders patient demographics and order history", async () => {
    renderWithQuery(<PatientDetail patientId={testPatient.id} />);
    expect(await screen.findByText("Aditi Nair")).toBeInTheDocument();
    expect(await screen.findByText(order.orderNumber)).toBeInTheDocument();
  });

  it("renders staff directory records for an owner", async () => {
    renderWithQuery(<StaffPage />);
    expect(await screen.findByText("Staff accounts")).toBeInTheDocument();
    expect(await screen.findByText("owner@example.test")).toBeInTheDocument();
    expect(mocks.apiPageRequest).toHaveBeenCalledWith("/users?page=1&limit=5");
    expect(screen.getByRole("button", { name: "Add staff" })).toBeInTheDocument();
  });

  it("confirms staff deactivation in an application dialog", async () => {
    const user = userEvent.setup();
    mocks.apiPageRequest.mockResolvedValue(paginated([{
      id: "receptionist-1",
      employeeCode: "EMP-003",
      firstName: "Demo",
      lastName: "Receptionist",
      email: "receptionist@example.test",
      phone: "9000000003",
      role: "RECEPTIONIST",
      isActive: true,
    }]));
    renderWithQuery(<StaffPage />);

    await user.click(await screen.findByRole("button", { name: "Deactivate" }));
    expect(await screen.findByRole("dialog", { name: "Deactivate staff account?" })).toBeInTheDocument();
    expect(mocks.apiRequest).not.toHaveBeenCalledWith(
      "/users/receptionist-1/deactivate",
      expect.anything(),
    );

    await user.click(screen.getByRole("button", { name: "Deactivate account" }));
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/users/receptionist-1/deactivate",
      { method: "PATCH" },
    );
  });

  it("shows staff actions to an admin only for operational roles", async () => {
    mocks.currentUserQuery.mockResolvedValue({
      ...owner,
      id: "admin-1",
      role: "ADMIN",
    });
    mocks.apiPageRequest.mockResolvedValue(paginated([
      {
        id: "owner-2",
        employeeCode: "EMP-001",
        firstName: "Another",
        lastName: "Owner",
        email: "another-owner@example.test",
        phone: "9000000001",
        role: "OWNER",
        isActive: true,
      },
      {
        id: "admin-2",
        employeeCode: "EMP-002",
        firstName: "Another",
        lastName: "Admin",
        email: "another-admin@example.test",
        phone: "9000000002",
        role: "ADMIN",
        isActive: true,
      },
      {
        id: "receptionist-1",
        employeeCode: "EMP-003",
        firstName: "Demo",
        lastName: "Receptionist",
        email: "receptionist@example.test",
        phone: "9000000003",
        role: "RECEPTIONIST",
        isActive: true,
      },
    ]));

    renderWithQuery(<StaffPage />);

    const ownerRow = (await screen.findByText("another-owner@example.test")).closest("tr");
    const adminRow = screen.getByText("another-admin@example.test").closest("tr");
    const receptionistRow = screen.getByText("receptionist@example.test").closest("tr");

    expect(ownerRow).not.toHaveTextContent("Reset password");
    expect(ownerRow).not.toHaveTextContent("Deactivate");
    expect(adminRow).not.toHaveTextContent("Reset password");
    expect(adminRow).not.toHaveTextContent("Deactivate");
    expect(receptionistRow).toHaveTextContent("Reset password");
    expect(receptionistRow).toHaveTextContent("Deactivate");
  });

  it("shows Owner actions for Admin accounts but not Owner self-deactivation", async () => {
    mocks.apiPageRequest.mockResolvedValue(paginated([
      {
        id: owner.id,
        employeeCode: "EMP-001",
        firstName: owner.firstName,
        lastName: owner.lastName,
        email: owner.email,
        role: owner.role,
        phone: "9000000001",
        isActive: true,
      },
      {
        id: "admin-1",
        employeeCode: "EMP-002",
        firstName: "Demo",
        lastName: "Admin",
        email: "admin@example.test",
        phone: "9000000002",
        role: "ADMIN",
        isActive: true,
      },
    ]));

    renderWithQuery(<StaffPage />);

    const ownerRow = (await screen.findByText("owner@example.test")).closest("tr");
    const adminRow = screen.getByText("admin@example.test").closest("tr");
    expect(ownerRow).toHaveTextContent("Reset password");
    expect(ownerRow).not.toHaveTextContent("Deactivate");
    expect(adminRow).toHaveTextContent("Reset password");
    expect(adminRow).toHaveTextContent("Deactivate");
  });
});

describe("catalogue and laboratory workflow screens", () => {
  it("shows category and test management controls to an owner", async () => {
    renderWithQuery(<TestCataloguePage />);
    expect(await screen.findByRole("button", { name: "Add category" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add test" })).toBeInTheDocument();
  });

  it("renders the order list and test-order entry point", async () => {
    renderWithQuery(<OrdersPage />);
    expect(await screen.findByText(order.orderNumber)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create order" })).toBeInTheDocument();
  });

  it("renders order detail and available sample collection action", async () => {
    renderWithQuery(<OrderDetailPage />);
    expect(await screen.findByText(order.orderNumber)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collected" })).toBeInTheDocument();
  });

  it("renders the sample-tracking empty state", async () => {
    renderWithQuery(<SamplesPage />);
    expect(await screen.findByText("No samples found.")).toBeInTheDocument();
    expect(mocks.listSamples).toHaveBeenCalled();
  });
});
