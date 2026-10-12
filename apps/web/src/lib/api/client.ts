import axios, { type AxiosRequestConfig } from "axios";

export interface ApiResponse<T> {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PageResult<T> {
  data: T[];
  meta: PageMeta;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly errors?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

interface ApiErrorPayload {
  message?: unknown;
  errors?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

export async function apiRequest<T>(
  path: string,
  config: AxiosRequestConfig = {},
): Promise<ApiResponse<T>> {
  try {
    const response = await apiClient.request<ApiResponse<T>>({
      ...config,
      url: path,
    });
    return response.data;
  } catch (error) {
    if (!axios.isAxiosError<ApiErrorPayload>(error)) {
      throw error;
    }

    const body = isRecord(error.response?.data) ? error.response.data : {};
    const rawMessage = body.message;
    const errors = Array.isArray(body.errors)
      ? body.errors.filter((item): item is string => typeof item === "string")
      : undefined;
    const message = Array.isArray(rawMessage)
      ? rawMessage.filter((item): item is string => typeof item === "string").join("; ")
      : typeof rawMessage === "string"
        ? rawMessage
        : error.response
          ? `The API request failed with status ${error.response.status}.`
          : "Unable to reach the lab service.";

    throw new ApiError(message, error.response?.status ?? 0, errors);
  }
}

export async function apiDownload(path: string): Promise<Blob> {
  try {
    const response = await apiClient.request<Blob>({
      method: "POST",
      url: path,
      responseType: "blob",
    });
    return response.data;
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error;
    const responseData = error.response?.data;
    let body: ApiErrorPayload = {};
    if (responseData instanceof Blob) {
      const text = await responseData.text();
      try {
        const parsed: unknown = JSON.parse(text);
        if (isRecord(parsed)) body = parsed;
      } catch {
        body = {};
      }
    } else if (isRecord(responseData)) {
      body = responseData;
    }
    const rawMessage = body.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.filter((item): item is string => typeof item === "string").join("; ")
      : typeof rawMessage === "string"
        ? rawMessage
        : error.response
          ? `The API request failed with status ${error.response.status}.`
          : "Unable to reach the lab service.";
    const errors = Array.isArray(body.errors)
      ? body.errors.filter((item): item is string => typeof item === "string")
      : undefined;
    throw new ApiError(message, error.response?.status ?? 0, errors);
  }
}

function isPageMeta(
  meta: Record<string, unknown> | undefined,
): meta is Record<string, unknown> & PageMeta {
  return (
    meta !== undefined &&
    Number.isInteger(meta.page) &&
    Number.isInteger(meta.limit) &&
    Number.isInteger(meta.total) &&
    Number.isInteger(meta.totalPages)
  );
}

export async function apiPageRequest<T>(
  path: string,
  config: AxiosRequestConfig = {},
): Promise<PageResult<T>> {
  const response = await apiRequest<T[]>(path, config);
  if (!Array.isArray(response.data) || !isPageMeta(response.meta)) {
    throw new ApiError("The API returned an invalid paginated response.", 0);
  }
  return { data: response.data, meta: response.meta };
}
