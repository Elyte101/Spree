import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchChatToken, type ChatTokenPayload } from "./chat";

const PAYLOAD: ChatTokenPayload = {
  token: "test-token",
  userId: "user-abc",
  channelId: "support-user-abc",
  apiKey: "stream-api-key",
};

function mockFetch(opts: {
  ok: boolean;
  json?: () => Promise<unknown>;
  rejectWith?: Error;
  signal?: boolean;
}) {
  if (opts.rejectWith) {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(opts.rejectWith));
    return;
  }
  if (opts.signal) {
    // Never resolves — aborts when signal fires
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise<never>((_, reject) => {
            (init.signal as AbortSignal).addEventListener("abort", () => {
              reject(new DOMException("The user aborted a request.", "AbortError"));
            });
          })
      )
    );
    return;
  }
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: opts.ok,
      json: opts.json ?? (() => Promise.resolve(PAYLOAD)),
    })
  );
}

describe("fetchChatToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // --- successful connection path ----------------------------------------

  it("resolves ok:true with token payload on 200", async () => {
    mockFetch({ ok: true });
    const result = await fetchChatToken();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token).toBe(PAYLOAD.token);
      expect(result.userId).toBe(PAYLOAD.userId);
      expect(result.channelId).toBe(PAYLOAD.channelId);
      expect(result.apiKey).toBe(PAYLOAD.apiKey);
    }
  });

  // --- server error path -------------------------------------------------

  it("returns server_error with detail from response body on non-ok status", async () => {
    mockFetch({
      ok: false,
      json: () => Promise.resolve({ detail: "Stream Chat is not configured." }),
    });
    const result = await fetchChatToken();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("server_error");
      expect(result.message).toBe("Stream Chat is not configured.");
    }
  });

  it("uses fallback message when non-ok response body is not JSON", async () => {
    mockFetch({
      ok: false,
      json: () => Promise.reject(new Error("not json")),
    });
    const result = await fetchChatToken();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("server_error");
      expect(result.message).toContain("unavailable");
    }
  });

  // --- timeout path -------------------------------------------------------

  it("returns timeout when fetch exceeds timeoutMs", async () => {
    mockFetch({ ok: false, signal: true }); // hangs until signal fires
    const result = await fetchChatToken(10); // 10 ms timeout
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("timeout");
      expect(result.message).toContain("timed out");
    }
  });

  // --- network error path -------------------------------------------------

  it("returns network_error on non-AbortError exception", async () => {
    mockFetch({ ok: false, rejectWith: new TypeError("Failed to fetch") });
    const result = await fetchChatToken();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("network_error");
      expect(result.message).toContain("connection");
    }
  });

  // --- retry path ---------------------------------------------------------

  it("succeeds on a second call after an initial failure (retry scenario)", async () => {
    // First call: server error
    mockFetch({
      ok: false,
      json: () => Promise.resolve({ detail: "temporarily unavailable" }),
    });
    const first = await fetchChatToken();
    expect(first.ok).toBe(false);

    // Retry: server returns 200
    mockFetch({ ok: true });
    const retry = await fetchChatToken();
    expect(retry.ok).toBe(true);
    if (retry.ok) {
      expect(retry.token).toBe(PAYLOAD.token);
    }
  });
});
