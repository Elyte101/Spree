import "server-only";

import { getBackendApiBaseUrl, getBackendInternalApiKey } from "@/lib/runtimeConfig";

// Split out of auth.ts so this backend-facing logic can be unit-tested
// without importing next-auth/next-auth-providers — importing those under
// vitest's plain node environment fails to resolve next/server internals.

export type AppUserRole = "customer" | "vendor" | "admin";

export async function callBackend(
  path: string,
  body: object,
  extraHeaders?: Record<string, string>
) {
  return fetch(`${getBackendApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Api-Key": getBackendInternalApiKey(),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
}

export interface OAuthSyncResult {
  id: string;
  role: AppUserRole;
  emailVerified: true;
}

/**
 * A9: extracted so the "deny cleanly on backend-sync failure" contract is
 * unit-testable without spinning up the full NextAuth handler stack. Called
 * from auth.ts's jwt callback; a `null` return is the sole signal it uses to
 * deny sign-in outright (`return null as unknown as typeof token`) rather
 * than producing a half-populated token (no id/role set, but signed in).
 */
export async function syncOAuthUser(
  user: { email?: string | null; name?: string | null },
  account: { provider: string; providerAccountId: string },
  providerEmailVerified: boolean
): Promise<OAuthSyncResult | null> {
  try {
    const res = await callBackend("/auth/oauth-upsert", {
      email: user.email,
      name: user.name,
      provider: account.provider,
      provider_account_id: account.providerAccountId,
      email_verified: providerEmailVerified,
    });
    if (!res.ok) return null;
    const backendUser = await res.json();
    return { id: backendUser.id, role: backendUser.role as AppUserRole, emailVerified: true };
  } catch {
    return null;
  }
}
