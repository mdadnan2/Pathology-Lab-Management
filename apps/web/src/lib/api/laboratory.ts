import { ApiError, apiDownload, apiPageRequest, apiRequest } from "./client";
import type { PageResult } from "./client";

export type { PageMeta, PageResult } from "./client";

export const PAGE_SIZE = 5;

export interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  bloodGroup: string | null;
  address: string | null;
  createdAt: string;
}

export interface TestCategory {
  id: string;
  code: string;
  name: string;
}

export interface LabTest {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  category: TestCategory;
  specimenType: string;
  department: string;
  price: string;
  turnaroundHours: number;
  isActive: boolean;
  description: string | null;
  parameters: Array<{
    id: string;
    name: string;
    unit: string | null;
    referenceRangeText: string | null;
    referenceRangeLow?: string | null;
    referenceRangeHigh?: string | null;
  }>;
}

export interface TestPackage {
  id: string;
  name: string;
  description: string | null;
  price: string;
  items: Array<{ labTest: Pick<LabTest, "id" | "code" | "name"> }>;
}

export type SampleStatus =
  | "PENDING"
  | "COLLECTED"
  | "PROCESSING"
  | "COMPLETED"
  | "REJECTED"
  | "RECOLLECTION_REQUESTED";

export interface LabOrder {
  id: string;
  orderNumber: string;
  status: string;
  notes: string | null;
  createdAt: string;
  patient: Pick<
    Patient,
    "id" | "patientCode" | "firstName" | "lastName" | "phone"
  >;
  items: Array<{
    id: string;
    status: string;
    testNameSnapshot: string;
    priceSnapshot: string;
    labTest: Pick<LabTest, "code" | "name">;
  }>;
  samples: Array<{ id?: string; sampleId: string; status: SampleStatus }>;
  invoice?: {
    invoiceNumber: string;
    totalAmount: string;
    paidAmount: string;
    status: string;
  } | null;
  createdBy?: { firstName: string; lastName: string; employeeCode: string };
  report?: { status: string } | null;
}

export interface LabSample {
  id: string;
  sampleId: string;
  status: SampleStatus;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  collectedAt: string | null;
  order: {
    id: string;
    orderNumber: string;
    patient: Pick<Patient, "patientCode" | "firstName" | "lastName">;
    items: Array<{
      testNameSnapshot: string;
      labTest: Pick<LabTest, "name" | "code">;
    }>;
  };
  collectedBy: { firstName: string; lastName: string } | null;
}

export type ResultStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface ResultWorkItem {
  id: string;
  status: string;
  testNameSnapshot: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    patient: Pick<Patient, "id" | "patientCode" | "firstName" | "lastName">;
  };
  labTest: Pick<LabTest, "name" | "code"> & {
    parameters: Array<{
      id: string;
      name: string;
      unit: string | null;
      referenceRangeText: string | null;
      referenceRangeLow: string | null;
      referenceRangeHigh: string | null;
    }>;
  };
  result: {
    id: string;
    status: ResultStatus;
    notes: string | null;
    rejectionReason: string | null;
    parameters: Array<{
      testParameterId: string;
      value: string;
      unit: string | null;
      isAbnormal: boolean;
    }>;
  } | null;
}

export interface LabReport {
  id: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "DELIVERED";
  generatedAt: string | null;
  approvedAt: string | null;
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    patient: Pick<Patient, "patientCode" | "firstName" | "lastName" | "dateOfBirth" | "gender">;
    items: Array<{
      id: string;
      testNameSnapshot: string;
      result: {
        notes: string | null;
        parameters: Array<{
          value: string;
          unit: string | null;
          isAbnormal: boolean;
          testParameter: {
            name: string;
            referenceRangeLow: string | null;
            referenceRangeHigh: string | null;
            referenceRangeText: string | null;
          };
        }>;
      } | null;
    }>;
  };
  approvedBy: { firstName: string; lastName: string; role: string } | null;
}

export interface ReportEligibleOrder {
  id: string;
  orderNumber: string;
  patient: Pick<Patient, "firstName" | "lastName">;
}

export async function listResults(params: {
  page?: number;
  limit?: number;
  status?: ResultStatus | "";
} = {}): Promise<PageResult<ResultWorkItem>> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });
  if (params.status) query.set("status", params.status);
  return apiPageRequest<ResultWorkItem>(`/results?${query}`);
}

export async function saveResultDraft(
  orderItemId: string,
  values: { parameters: Array<{ testParameterId: string; value: string }>; notes?: string },
): Promise<ResultWorkItem["result"]> {
  return (await apiRequest<ResultWorkItem["result"]>(`/results/items/${orderItemId}`, {
    method: "POST",
    data: values,
  })).data;
}

export async function submitResult(id: string): Promise<void> {
  await apiRequest(`/results/${id}/submit`, { method: "POST" });
}

export async function reviewResult(
  id: string,
  status: "UNDER_REVIEW" | "APPROVED" | "REJECTED",
  rejectionReason?: string,
): Promise<void> {
  await apiRequest(`/results/${id}/review`, {
    method: "PATCH",
    data: { status, ...(rejectionReason ? { rejectionReason } : {}) },
  });
}

export async function listReports(params: {
  page?: number;
  limit?: number;
  status?: LabReport["status"] | "";
  search?: string;
  from?: string;
  to?: string;
} = {}): Promise<PageResult<LabReport>> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });
  if (params.status) query.set("status", params.status);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  return apiPageRequest<LabReport>(`/reports?${query}`);
}

export async function listReportEligibleOrders(params: {
  page?: number;
  limit?: number;
} = {}): Promise<PageResult<ReportEligibleOrder>> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });
  return apiPageRequest<ReportEligibleOrder>(`/reports/eligible-orders?${query}`);
}

export async function generateReport(orderId: string): Promise<LabReport> {
  return (await apiRequest<LabReport>(`/reports/orders/${orderId}/generate`, {
    method: "POST",
  })).data;
}

export async function approveReport(id: string): Promise<void> {
  await apiRequest(`/reports/${id}/approve`, { method: "PATCH" });
}

export async function downloadReport(id: string): Promise<Blob> {
  return apiDownload(`/reports/${id}/download`);
}

export interface PatientCreateValues {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth: string;
  gender: Patient["gender"];
  address?: string;
}

export async function listPatients(
  page: number,
  search: string,
  limit = PAGE_SIZE,
): Promise<PageResult<Patient>> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) query.set("search", search.trim());
  return apiPageRequest<Patient>(`/patients?${query}`);
}

export async function createPatient(
  values: PatientCreateValues,
): Promise<{ data: Patient; meta: { duplicateWarning: boolean } }> {
  const response = await apiRequest<Patient>("/patients", {
    method: "POST",
    data: values,
  });
  if (!response.meta || typeof response.meta.duplicateWarning !== "boolean") {
    throw new ApiError("The API returned invalid patient registration metadata.", 0);
  }
  return {
    data: response.data,
    meta: { duplicateWarning: response.meta.duplicateWarning },
  };
}

export async function listTests(params: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  activeOnly?: boolean;
} = {}): Promise<PageResult<LabTest>> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? PAGE_SIZE),
    activeOnly: String(params.activeOnly ?? true),
  });
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.categoryId) query.set("categoryId", params.categoryId);
  return apiPageRequest<LabTest>(`/test-catalogue?${query}`);
}

export async function listOrders(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sampleStatus?: SampleStatus | "";
  patientId?: string;
  from?: string;
  to?: string;
} = {}): Promise<PageResult<LabOrder>> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? PAGE_SIZE),
  });
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status) query.set("status", params.status);
  if (params.sampleStatus) query.set("sampleStatus", params.sampleStatus);
  if (params.patientId) query.set("patientId", params.patientId);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  return apiPageRequest<LabOrder>(`/orders?${query}`);
}

export async function listSamples(params: {
  page?: number;
  limit?: number;
  status?: SampleStatus | "";
} = {}): Promise<PageResult<LabSample>> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? PAGE_SIZE),
  });
  if (params.status) query.set("status", params.status);
  return apiPageRequest<LabSample>(`/samples?${query}`);
}

export async function listTestPackages(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<PageResult<TestPackage>> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? PAGE_SIZE),
  });
  if (params.search?.trim()) query.set("search", params.search.trim());
  return apiPageRequest<TestPackage>(`/test-packages?${query}`);
}

export async function getOrder(id: string): Promise<LabOrder> {
  return (await apiRequest<LabOrder>(`/orders/${id}`)).data;
}

export async function getSample(id: string): Promise<LabSample> {
  return (await apiRequest<LabSample>(`/samples/${id}`)).data;
}

export type InvoiceStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
export type PaymentMethod = "CASH" | "CARD" | "UPI" | "BANK_TRANSFER";

export interface InvoicePayment {
  id: string;
  amount: string;
  method: PaymentMethod;
  referenceNumber: string | null;
  notes: string | null;
  paidAt: string;
  isReversed: boolean;
  reversedAt: string | null;
  recordedBy: { firstName: string; lastName: string; employeeCode: string };
}

export interface InvoiceAdjustment {
  id: string;
  type: "DISCOUNT" | "REVERSAL" | "CANCELLATION";
  amount: string;
  reason: string;
  createdAt: string;
  authorizedBy: { firstName: string; lastName: string; employeeCode: string };
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: string;
  discountAmount: string;
  totalAmount: string;
  paidAmount: string;
  createdAt: string;
  cancelledAt: string | null;
  patient: Pick<Patient, "id" | "patientCode" | "firstName" | "lastName" | "phone">;
  order: { id: string; orderNumber: string };
  createdBy: { firstName: string; lastName: string; employeeCode: string };
  items: Array<{
    id: string;
    testNameSnapshot: string;
    priceSnapshot: string;
    quantity: number;
  }>;
  payments: InvoicePayment[];
  adjustments: InvoiceAdjustment[];
}

export async function listInvoices(params: {
  page?: number;
  limit?: number;
  status?: InvoiceStatus | "";
  patientId?: string;
  search?: string;
  from?: string;
  to?: string;
} = {}): Promise<PageResult<Invoice>> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? PAGE_SIZE),
  });
  if (params.status) query.set("status", params.status);
  if (params.patientId) query.set("patientId", params.patientId);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  return apiPageRequest<Invoice>(`/invoices?${query}`);
}

export async function getInvoice(id: string): Promise<Invoice> {
  return (await apiRequest<Invoice>(`/invoices/${id}`)).data;
}

export async function recordPayment(
  invoiceId: string,
  values: { amount: number; method: PaymentMethod; referenceNumber?: string; notes?: string },
): Promise<Invoice> {
  return (await apiRequest<Invoice>(`/invoices/${invoiceId}/payments`, { method: "POST", data: values })).data;
}

export async function applyDiscount(
  invoiceId: string,
  values: { amount: number; reason: string },
): Promise<Invoice> {
  return (await apiRequest<Invoice>(`/invoices/${invoiceId}/discount`, { method: "POST", data: values })).data;
}

export async function cancelInvoice(
  invoiceId: string,
  values: { reason: string },
): Promise<Invoice> {
  return (await apiRequest<Invoice>(`/invoices/${invoiceId}/cancel`, { method: "PATCH", data: values })).data;
}

export async function reversePayment(
  invoiceId: string,
  paymentId: string,
  values: { reason: string },
): Promise<Invoice> {
  return (await apiRequest<Invoice>(`/invoices/${invoiceId}/payments/${paymentId}/reverse`, { method: "PATCH", data: values })).data;
}

export async function listOutstandingDues(
  page = 1,
  limit = PAGE_SIZE,
): Promise<PageResult<Invoice>> {
  return apiPageRequest<Invoice>(`/invoices/outstanding?page=${page}&limit=${limit}`);
}

export interface DailyCollectionsRow {
  date: string;
  totalCollected: string;
  byMethod: Partial<Record<PaymentMethod, string>>;
}

export async function getDailyCollections(from: string, to: string): Promise<{
  rows: DailyCollectionsRow[];
  outstanding: string;
}> {
  return (await apiRequest<{ rows: DailyCollectionsRow[]; outstanding: string }>(
    `/invoices/collections?from=${from}&to=${to}`,
  )).data;
}

export async function updateSampleStatus(
  id: string,
  values: { status: SampleStatus; rejectionReason?: string; notes?: string },
): Promise<LabSample> {
  return (
    await apiRequest<LabSample>(`/samples/${id}/status`, {
      method: "PATCH",
      data: values,
    })
  ).data;
}
