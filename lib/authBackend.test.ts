import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/runtimeConfig", () => ({
  getBackendApiBaseUrl: () => "http://localhost:8000/api/v1",
  getBackendInternalApiKey: () => "test-internal-key",
}));

import { syncOAuthUser } from "./authBackend";

const account = { provider: "google", providerAccountId: "google-acct-123" };
const user = { email: "victim@example.com", name: "Victim" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("syncOAuthUser — A9: OAuth-sync-failure denies cleanly", () => {
  it("returns a fully populated result on success (never half-populated)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "user-abc", role: "customer" }), { status: 200 })
      )
    );

    const result = await syncOAuthUser(user, account, true);

    expect(result).toEqual({ id: "user-abc", role: "customer", emailVerified: true });
  });

  it("returns null when the backend responds non-2xx (e.g. 403/409 from A3 link denial)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "already registered" }), { status: 409 })
      )
    );

    const result = await syncOAuthUser(user, account, true);

    expect(result).toBeNull();
  });

  it("returns null when the backend is unreachable (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch failed")));

    const result = await syncOAuthUser(user, account, true);

    expect(result).toBeNull();
  });

  it("returns null when the backend times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      })
    );

    const result = await syncOAuthUser(user, account, true);

    expect(result).toBeNull();
  });

  it("never returns a result with some fields set and others missing", async () => {
    // Guards the "broken half-session" failure mode directly: whatever the
    // outcome, the result is either fully absent (null, deny) or fully
    // present (id + role + emailVerified, allow) — nothing in between that
    // the jwt callback could partially apply to the token.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "user-xyz", role: "vendor" }), { status: 200 }))
    );

    const result = await syncOAuthUser(user, account, true);

    expect(result).not.toBeNull();
    expect(Object.keys(result ?? {}).sort()).toEqual(["emailVerified", "id", "role"]);
  });
});
