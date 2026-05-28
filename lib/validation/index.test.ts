import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseOrBadRequest } from "./index";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  age: z.number().max(120),
});

describe("parseOrBadRequest — error envelope", () => {
  it("returns ok:true for valid input", () => {
    const result = parseOrBadRequest(Schema, {
      email: "user@example.com",
      password: "secret123",
      age: 25,
    });
    expect(result.ok).toBe(true);
  });

  it("returns 400 with envelope for invalid input", async () => {
    const result = parseOrBadRequest(Schema, { email: "bad", password: "short", age: 25 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body).toMatchObject({
        detail: "Validation failed",
        code: "validation_error",
        errors: expect.arrayContaining([
          { path: "email", code: expect.any(String) },
          { path: "password", code: "too_short" },
        ]),
      });
    }
  });

  it("maps missing required field to code=required", async () => {
    const result = parseOrBadRequest(Schema, { password: "secret123", age: 25 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      const emailIssue = (body.errors as { path: string; code: string }[]).find(
        (e) => e.path === "email"
      );
      expect(emailIssue?.code).toBe("required");
    }
  });

  it("includes X-Request-Id header", async () => {
    const result = parseOrBadRequest(Schema, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.headers.get("X-Request-Id")).toBeTruthy();
    }
  });

  it("maps too_small to too_short for string min()", async () => {
    const result = parseOrBadRequest(Schema, {
      email: "user@example.com",
      password: "ab",
      age: 25,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      const pwdIssue = (body.errors as { path: string; code: string }[]).find(
        (e) => e.path === "password"
      );
      expect(pwdIssue?.code).toBe("too_short");
    }
  });

  it("maps too_big to too_long for number max()", async () => {
    const result = parseOrBadRequest(Schema, {
      email: "user@example.com",
      password: "secret123",
      age: 999,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      const ageIssue = (body.errors as { path: string; code: string }[]).find(
        (e) => e.path === "age"
      );
      expect(ageIssue?.code).toBe("too_long");
    }
  });
});
