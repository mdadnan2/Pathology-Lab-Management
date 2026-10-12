import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("./client", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
    }
  },
  apiRequest,
}));

import { getCurrentUser } from "./auth";

describe("getCurrentUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts the standard single-level profile envelope", async () => {
    const user = {
      id: "owner-1",
      firstName: "Demo",
      lastName: "Owner",
      email: "owner@example.test",
      role: "OWNER",
      mustChangePassword: false,
    };
    apiRequest.mockResolvedValue({ data: user });

    await expect(getCurrentUser()).resolves.toEqual(user);
    expect(apiRequest).toHaveBeenCalledWith("/auth/me");
  });

  it("normalizes a nested profile envelope without granting a fallback role", async () => {
    const user = {
      id: "admin-1",
      firstName: "Demo",
      lastName: "Admin",
      email: "admin@example.test",
      role: "ADMIN",
      mustChangePassword: false,
    };
    apiRequest.mockResolvedValue({ data: { data: user } });

    await expect(getCurrentUser()).resolves.toEqual(user);
  });

  it("rejects an unknown role or malformed profile", async () => {
    apiRequest.mockResolvedValue({
      data: { id: "user-1", role: "SUPERUSER" },
    });

    await expect(getCurrentUser()).rejects.toThrow(
      "The API returned an invalid staff profile.",
    );
  });
});
