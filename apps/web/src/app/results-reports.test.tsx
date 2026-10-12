import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  listResults: vi.fn(),
  reviewResult: vi.fn(),
  saveResultDraft: vi.fn(),
  submitResult: vi.fn(),
  listReports: vi.fn(),
  listReportEligibleOrders: vi.fn(),
  generateReport: vi.fn(),
  approveReport: vi.fn(),
  downloadReport: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/api/laboratory", () => ({
  listResults: mocks.listResults,
  reviewResult: mocks.reviewResult,
  saveResultDraft: mocks.saveResultDraft,
  submitResult: mocks.submitResult,
  listReports: mocks.listReports,
  listReportEligibleOrders: mocks.listReportEligibleOrders,
  generateReport: mocks.generateReport,
  approveReport: mocks.approveReport,
  downloadReport: mocks.downloadReport,
}));

import ResultsPage from "@/app/(dashboard)/results/page";
import ReportsPage from "@/app/(dashboard)/reports/page";

const item = {
  id: "item-1",
  status: "PROCESSING",
  testNameSnapshot: "Fictional CBC",
  order: {
    id: "order-1",
    orderNumber: "DEMO-ORD-0001",
    status: "PROCESSING",
    patient: {
      id: "patient-1",
      patientCode: "PAT-DEMO-0001",
      firstName: "Fictional",
      lastName: "Patient",
    },
  },
  labTest: {
    code: "CBC",
    name: "Fictional CBC",
    parameters: [{
      id: "parameter-1",
      name: "Hemoglobin",
      unit: "g/dL",
      referenceRangeText: "12 - 17.5",
      referenceRangeLow: "12",
      referenceRangeHigh: "17.5",
    }],
  },
  result: null,
};

const report = {
  id: "report-1",
  status: "PENDING_APPROVAL" as const,
  generatedAt: "2026-10-12T08:00:00.000Z",
  approvedAt: null,
  approvedBy: null,
  order: {
    id: "order-1",
    orderNumber: "DEMO-ORD-0001",
    createdAt: "2026-10-12T07:00:00.000Z",
    patient: {
      patientCode: "PAT-DEMO-0001",
      firstName: "Fictional",
      lastName: "Patient",
      dateOfBirth: "1990-01-01",
      gender: "OTHER",
    },
    items: [{
      id: "item-1",
      testNameSnapshot: "Fictional CBC",
      result: { notes: null, parameters: [] },
    }],
  },
};

function page(data: unknown[]) {
  return { data, meta: { page: 1, limit: 10, total: data.length, totalPages: 1 } };
}

function renderPage(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({
    id: "technician-1",
    firstName: "Demo",
    lastName: "Technician",
    email: "tech@example.test",
    role: "TECHNICIAN",
    mustChangePassword: false,
  });
  mocks.listResults.mockResolvedValue(page([item]));
  mocks.reviewResult.mockResolvedValue(undefined);
  mocks.saveResultDraft.mockResolvedValue({ id: "result-1" });
  mocks.submitResult.mockResolvedValue(undefined);
  mocks.listReports.mockResolvedValue(page([report]));
  mocks.listReportEligibleOrders.mockResolvedValue(page([]));
  mocks.generateReport.mockResolvedValue(report);
  mocks.approveReport.mockResolvedValue(undefined);
  mocks.downloadReport.mockResolvedValue(new Blob(["demo-pdf"], { type: "application/pdf" }));
});

describe("results and reports role workflows", () => {
  it("lets a Technician enter values without exposing Pathologist review actions", async () => {
    renderPage(<ResultsPage />);

    expect(await screen.findByRole("heading", { name: "Results" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Hemoglobin value")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve result" })).not.toBeInTheDocument();
  });

  it("saves a complete Technician result before submitting it", async () => {
    renderPage(<ResultsPage />);
    const valueInput = await screen.findByLabelText("Hemoglobin value");
    await userEvent.type(valueInput, "15");
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    await waitFor(() => {
      expect(mocks.saveResultDraft).toHaveBeenCalledWith("item-1", {
        parameters: [{ testParameterId: "parameter-1", value: "15" }],
      });
      expect(mocks.submitResult).toHaveBeenCalledWith("result-1");
    });
  });

  it("lets a Pathologist start review for a submitted result", async () => {
    mocks.user.mockResolvedValue({
      id: "pathologist-1",
      firstName: "Demo",
      lastName: "Pathologist",
      email: "path@example.test",
      role: "PATHOLOGIST",
      mustChangePassword: false,
    });
    mocks.listResults.mockResolvedValue(page([{
      ...item,
      result: {
        id: "result-1",
        status: "SUBMITTED",
        notes: null,
        rejectionReason: null,
        parameters: [{ testParameterId: "parameter-1", value: "13", unit: "g/dL", isAbnormal: false }],
      },
    }]));

    renderPage(<ResultsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Start review" }));

    await waitFor(() => expect(mocks.reviewResult).toHaveBeenCalledWith(
      "result-1",
      "UNDER_REVIEW",
      undefined,
    ));
  });

  it("allows Receptionists to deliver approved reports, but not approve them", async () => {
    mocks.user.mockResolvedValue({
      id: "receptionist-1",
      firstName: "Demo",
      lastName: "Receptionist",
      email: "reception@example.test",
      role: "RECEPTIONIST",
      mustChangePassword: false,
    });
    mocks.listReports.mockResolvedValue(page([{
      ...report,
      status: "APPROVED",
      approvedBy: { firstName: "Demo", lastName: "Pathologist", role: "PATHOLOGIST" },
    }]));

    renderPage(<ReportsPage />);

    expect(await screen.findByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve report" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate report" })).not.toBeInTheDocument();
  });

  it("allows a Pathologist to generate a report for an approved order", async () => {
    mocks.user.mockResolvedValue({
      id: "pathologist-1",
      firstName: "Demo",
      lastName: "Pathologist",
      email: "path@example.test",
      role: "PATHOLOGIST",
      mustChangePassword: false,
    });
    mocks.listReports.mockResolvedValue(page([]));
    mocks.listReportEligibleOrders.mockResolvedValue(page([{
      id: "approved-order-1",
      orderNumber: "DEMO-ORD-0002",
      status: "APPROVED",
      patient: { firstName: "Fictional", lastName: "Patient" },
    }]));

    renderPage(<ReportsPage />);
    await screen.findByRole("option", { name: /DEMO-ORD-0002/ });
    const select = screen.getByLabelText("Approved order");
    await userEvent.selectOptions(select, "approved-order-1");
    await userEvent.click(screen.getByRole("button", { name: "Generate report" }));

    await waitFor(() => {
      expect(mocks.generateReport.mock.calls[0]?.[0]).toBe("approved-order-1");
    });
  });
});
