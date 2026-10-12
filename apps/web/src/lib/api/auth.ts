import { ApiError, apiRequest } from "./client";

export type StaffRole =
  | "OWNER"
  | "ADMIN"
  | "RECEPTIONIST"
  | "TECHNICIAN"
  | "PATHOLOGIST";

export interface CurrentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: StaffRole;
  mustChangePassword: boolean;
}

function isCurrentUser(value: unknown): value is CurrentUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    typeof user.firstName === "string" &&
    typeof user.lastName === "string" &&
    typeof user.email === "string" &&
    typeof user.role === "string" &&
    ["OWNER", "ADMIN", "RECEPTIONIST", "TECHNICIAN", "PATHOLOGIST"].includes(
      user.role,
    ) &&
    typeof user.mustChangePassword === "boolean"
  );
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await apiRequest<CurrentUser | { data: CurrentUser }>(
    "/auth/me",
  );
  const profile =
    typeof response.data === "object" &&
    response.data !== null &&
    "data" in response.data
      ? response.data.data
      : response.data;

  if (!isCurrentUser(profile)) {
    throw new ApiError("The API returned an invalid staff profile.", 0);
  }

  return profile;
}
