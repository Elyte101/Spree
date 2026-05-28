import { describe, it, expect } from "vitest";
import { SignUpSchema } from "./auth";

describe("SignUpSchema", () => {
  const valid = { name: "Ama Owusu", email: "ama@example.com", password: "secret123" };

  it("accepts valid signup data", () => {
    expect(SignUpSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(SignUpSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(SignUpSchema.safeParse({ ...valid, email: "not-email" }).success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    expect(SignUpSchema.safeParse({ ...valid, password: "abc" }).success).toBe(false);
  });

  it("rejects password longer than 128 characters", () => {
    expect(SignUpSchema.safeParse({ ...valid, password: "a".repeat(129) }).success).toBe(false);
  });

  it("rejects extra fields (stripped by default)", () => {
    const result = SignUpSchema.safeParse({ ...valid, role: "admin" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as unknown as Record<string, unknown>).role).toBeUndefined();
    }
  });
});
