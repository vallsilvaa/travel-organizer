import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

import { updateSession } from "./proxy";

function makeRequest(pathname: string) {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    });
  });

  it("redirects an unauthenticated visitor away from a protected route", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await updateSession(makeRequest("/dashboard"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/auth/sign-in");
    expect(location.searchParams.get("error")).toBe("authentication_required");
  });

  it("redirects an authenticated user away from the sign-in page", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const response = await updateSession(makeRequest("/auth/sign-in"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/dashboard");
  });

  it("does not loop when the session belongs to a deleted user", async () => {
    // A stale-but-unexpired JWT for a user that no longer exists: the
    // Auth server correctly reports no user, so getUser()-based checks on
    // both /dashboard and /auth/sign-in must agree, breaking any loop.
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const fromDashboard = await updateSession(makeRequest("/dashboard"));
    expect(new URL(fromDashboard.headers.get("location")!).pathname).toBe("/auth/sign-in");

    const fromSignIn = await updateSession(makeRequest("/auth/sign-in"));
    expect(fromSignIn.headers.get("location")).toBeNull();
  });

  it("passes through an unauthenticated visit to a public route", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await updateSession(makeRequest("/"));

    expect(response.headers.get("location")).toBeNull();
  });
});
