import { ApiClientError } from "@/lib/api";

// Shared client-side validation + server-error mapping for the sign-in/
// sign-up form (components/auth/signInForm.tsx). Kept outside the component
// so the pure logic is unit-testable without rendering.

export interface SignupFieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

export interface SigninFieldErrors {
  email?: string;
  password?: string;
}

export const hasFieldErrors = (
  errors: SignupFieldErrors | SigninFieldErrors
): boolean => Object.values(errors).some(Boolean);

// Simple structural check (username@domain.tld) — good enough for a
// pre-submit client-side gate; the backend is always the source of truth.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignupFields(values: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreedToTerms: boolean;
}): SignupFieldErrors {
  const errors: SignupFieldErrors = {};

  if (!values.name.trim()) {
    errors.name = "Please enter your full name";
  }

  if (!values.email.trim()) {
    errors.email = "Please enter your email address";
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Enter a valid email address";
  }

  if (!values.password) {
    errors.password = "Please enter a password";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Please confirm your password";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  if (!values.agreedToTerms) {
    errors.terms = "Please accept the Terms of Service and Privacy Policy";
  }

  return errors;
}

export function validateSigninFields(values: {
  email: string;
  password: string;
}): SigninFieldErrors {
  const errors: SigninFieldErrors = {};

  if (!values.email.trim()) {
    errors.email = "Please enter your email address";
  }
  if (!values.password) {
    errors.password = "Please enter your password";
  }

  return errors;
}

// Shape of app/api/auth/signup's error body — see lib/errors.ts#validationError.
// `errors` is only present for Next-side zod validation failures; the
// backend's own 409 (duplicate email) is a plain `{ detail }` with no
// structured field info, handled separately below by status code.
interface SignupApiErrorBody {
  code?: string;
  errors?: { path: string; code: string }[];
}

const FIELD_ERROR_MESSAGES: Record<string, Record<string, string>> = {
  name: {
    required: "Please enter your full name",
    too_short: "Please enter your full name",
    too_long: "That name is too long",
  },
  email: {
    required: "Please enter your email address",
    too_short: "Enter a valid email address",
    too_long: "That email address is too long",
    invalid_format: "Enter a valid email address",
    invalid_string: "Enter a valid email address",
  },
  password: {
    required: "Please enter a password",
    too_short: "Password must be at least 8 characters",
    too_long: "That password is too long",
  },
};

const DUPLICATE_EMAIL_MESSAGE =
  "An account with this email already exists. Try signing in.";

const GENERIC_SIGNUP_FAILURE_MESSAGE =
  "We couldn't create your account. Please try again.";

export function mapSignupError(err: unknown): {
  formMessage: string;
  fieldErrors: SignupFieldErrors;
} {
  if (!(err instanceof ApiClientError)) {
    return { formMessage: GENERIC_SIGNUP_FAILURE_MESSAGE, fieldErrors: {} };
  }

  // The backend returns a plain 409 (no structured `errors[]`) when the
  // email is already registered — see services/auth.py::register_user.
  if (err.status === 409) {
    return {
      formMessage: DUPLICATE_EMAIL_MESSAGE,
      fieldErrors: { email: "This email is already registered" },
    };
  }

  const body = err.body as SignupApiErrorBody | undefined;
  if (Array.isArray(body?.errors) && body.errors.length > 0) {
    const fieldErrors: SignupFieldErrors = {};
    for (const issue of body.errors) {
      if (issue.path !== "name" && issue.path !== "email" && issue.path !== "password") {
        continue;
      }
      const message = FIELD_ERROR_MESSAGES[issue.path]?.[issue.code];
      if (message) {
        fieldErrors[issue.path] = message;
      }
    }
    if (hasFieldErrors(fieldErrors)) {
      return {
        formMessage: "Please fix the highlighted fields and try again.",
        fieldErrors,
      };
    }
  }

  // Fallback — never surface a raw/internal string like "Validation failed"
  // or a stringified pydantic error list.
  const isInternalOrGenericMessage =
    !err.message || /validation failed/i.test(err.message) || err.status >= 500;
  return {
    formMessage: isInternalOrGenericMessage ? GENERIC_SIGNUP_FAILURE_MESSAGE : err.message,
    fieldErrors: {},
  };
}
