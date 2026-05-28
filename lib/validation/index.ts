import type { ZodIssue, ZodSchema } from "zod";

import type { ValidationIssue } from "@/lib/errors";
import { validationError } from "@/lib/errors";

export * from "./auth";
export * from "./order";

type ParseOk<T> = { ok: true; data: T };
type ParseFail = { ok: false; response: Response };

function mapIssue(issue: ZodIssue): ValidationIssue {
  const path = issue.path.map(String).join(".");
  // Zod v4 embeds "received undefined" in the message rather than a separate field.
  // Treat any invalid_type where the value was absent as a missing-required error.
  if (issue.code === "invalid_type" && issue.message.includes("received undefined")) {
    return { path, code: "required" };
  }
  if (issue.code === "too_small") return { path, code: "too_short" };
  if (issue.code === "too_big") return { path, code: "too_long" };
  return { path, code: issue.code };
}

export function parseOrBadRequest<T>(
  schema: ZodSchema<T>,
  data: unknown
): ParseOk<T> | ParseFail {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      response: validationError(result.error.issues.map(mapIssue)),
    };
  }
  return { ok: true, data: result.data };
}
