import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, recordFailedAttempt, clearFailedAttempts } from "./rateLimit";

// Freeze time so we can control the clock
beforeEach(() => {
  vi.useFakeTimers();
  clearFailedAttempts("test@example.com");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows a fresh identifier", () => {
    expect(checkRateLimit("test@example.com")).toEqual({ allowed: true });
  });

  it("allows up to 4 failures without lockout", () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt("test@example.com");
    expect(checkRateLimit("test@example.com")).toEqual({ allowed: true });
  });

  it("locks out after 5 failures", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("test@example.com");
    const result = checkRateLimit("test@example.com");
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("returns retryAfter in seconds", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("test@example.com");
    const { retryAfter } = checkRateLimit("test@example.com");
    // Should be ~900 seconds (15 minutes)
    expect(retryAfter).toBeGreaterThan(890);
    expect(retryAfter).toBeLessThanOrEqual(900);
  });

  it("releases lockout after the window expires", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("test@example.com");
    vi.advanceTimersByTime(15 * 60 * 1000 + 1); // 15 minutes + 1ms
    expect(checkRateLimit("test@example.com")).toEqual({ allowed: true });
  });

  it("resets counter after window expiry", () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt("test@example.com");
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    recordFailedAttempt("test@example.com"); // should start a fresh count
    expect(checkRateLimit("test@example.com")).toEqual({ allowed: true });
  });
});

describe("clearFailedAttempts", () => {
  it("clears an existing lockout", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("test@example.com");
    clearFailedAttempts("test@example.com");
    expect(checkRateLimit("test@example.com")).toEqual({ allowed: true });
  });

  it("is a no-op for unknown identifiers", () => {
    expect(() => clearFailedAttempts("nobody@example.com")).not.toThrow();
  });
});

describe("identifier isolation", () => {
  it("does not share state between different identifiers", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("alice@example.com");
    expect(checkRateLimit("bob@example.com")).toEqual({ allowed: true });
  });
});
