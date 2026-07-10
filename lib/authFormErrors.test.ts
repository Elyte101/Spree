import { describe, expect, it } from "vitest";
import { ApiClientError } from "./api";
import {
  hasFieldErrors,
  mapSignupError,
  validateSigninFields,
  validateSignupFields,
} from "./authFormErrors";

describe("validateSignupFields", () => {
  const valid = {
    name: "Jane Doe",
    email: "jane@example.com",
    password: "correcthorsebattery",
    confirmPassword: "correcthorsebattery",
    agreedToTerms: true,
  };

  it("passes for fully valid input", () => {
    expect(hasFieldErrors(validateSignupFields(valid))).toBe(false);
  });

  it("flags mismatched passwords on confirmPassword", () => {
    const errors = validateSignupFields({ ...valid, confirmPassword: "somethingElse123" });
    expect(errors.confirmPassword).toBe("Passwords do not match");
    expect(errors.password).toBeUndefined();
  });

  it("flags a too-short password (matching or not) without a stale mismatch error", () => {
    const errors = validateSignupFields({
      ...valid,
      password: "short1",
      confirmPassword: "short1",
    });
    expect(errors.password).toBe("Password must be at least 8 characters");
    expect(errors.confirmPassword).toBeUndefined();
  });

  it("flags an invalid email format", () => {
    const errors = validateSignupFields({ ...valid, email: "not-an-email" });
    expect(errors.email).toBe("Enter a valid email address");
  });

  it("requires every empty field individually", () => {
    const errors = validateSignupFields({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      agreedToTerms: false,
    });
    expect(errors.name).toBe("Please enter your full name");
    expect(errors.email).toBe("Please enter your email address");
    expect(errors.password).toBe("Please enter a password");
    expect(errors.confirmPassword).toBe("Please confirm your password");
    expect(errors.terms).toBeTruthy();
  });

  it("requires the terms checkbox", () => {
    const errors = validateSignupFields({ ...valid, agreedToTerms: false });
    expect(errors.terms).toBeTruthy();
  });
});

describe("validateSigninFields", () => {
  it("requires email and password", () => {
    const errors = validateSigninFields({ email: "", password: "" });
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });

  it("passes when both are present, regardless of format", () => {
    // Sign-in deliberately doesn't validate email format or password length
    // client-side — the backend gives a generic "invalid credentials" for
    // any mismatch, and over-validating here would leak information.
    const errors = validateSigninFields({ email: "whatever", password: "x" });
    expect(hasFieldErrors(errors)).toBe(false);
  });
});

describe("mapSignupError", () => {
  it("maps a 409 (duplicate email) to a friendly message + field error", () => {
    const err = new ApiClientError(409, "An account already exists for that email address");
    const { formMessage, fieldErrors } = mapSignupError(err);
    expect(formMessage).toMatch(/already exists/i);
    expect(fieldErrors.email).toBeTruthy();
  });

  it("maps structured validation errors[] to field-specific messages", () => {
    const err = new ApiClientError(400, "Validation failed", {
      code: "validation_error",
      errors: [
        { path: "email", code: "invalid_format" },
        { path: "password", code: "too_short" },
      ],
    });
    const { fieldErrors, formMessage } = mapSignupError(err);
    expect(fieldErrors.email).toBe("Enter a valid email address");
    expect(fieldErrors.password).toBe("Password must be at least 8 characters");
    expect(formMessage).not.toMatch(/validation failed/i);
  });

  it("maps a required-name error", () => {
    const err = new ApiClientError(400, "Validation failed", {
      errors: [{ path: "name", code: "required" }],
    });
    const { fieldErrors } = mapSignupError(err);
    expect(fieldErrors.name).toBe("Please enter your full name");
  });

  it("never surfaces the raw 'Validation failed' string, even with no mappable errors", () => {
    const err = new ApiClientError(400, "Validation failed", {
      code: "validation_error",
      errors: [{ path: "unknown_field", code: "some_unmapped_code" }],
    });
    const { formMessage, fieldErrors } = mapSignupError(err);
    expect(formMessage.toLowerCase()).not.toContain("validation failed");
    expect(hasFieldErrors(fieldErrors)).toBe(false);
  });

  it("falls back to a generic message for a non-ApiClientError", () => {
    const { formMessage, fieldErrors } = mapSignupError(new Error("network down"));
    expect(formMessage).toBe("We couldn't create your account. Please try again.");
    expect(hasFieldErrors(fieldErrors)).toBe(false);
  });

  it("falls back to a generic message for a 5xx with no body", () => {
    const err = new ApiClientError(500, "Request failed (500)");
    const { formMessage } = mapSignupError(err);
    expect(formMessage).toBe("We couldn't create your account. Please try again.");
  });
});
