import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { z } from "zod";

import { authConfig } from "./auth.config";
import { mintActorToken } from "@/lib/actorToken";
import { AppUserRole, callBackend, syncOAuthUser } from "@/lib/authBackend";
import { getBackendApiBaseUrl, getBackendInternalApiKey } from "@/lib/runtimeConfig";
import { isSafeCallbackUrl } from "@/lib/safeUrl";

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// A5/A7: surfaced when the backend's DB-backed login rate limiter (keyed on
// email + real client IP — see backend/app/services/auth.py) returns 429.
// signInForm.tsx already handles the "rate_limited" code from the outer
// app/api/auth/[...nextauth]/route.ts wrapper's own (best-effort, in-memory)
// pre-check; this is the same code surfaced from the authoritative backend
// check, reached whenever that pre-check didn't already catch it (e.g. after
// a serverless cold start reset its in-memory counters).
class LoginRateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

// Signed in via a garbage/unregistered/expired passkey response — mapped to
// a distinct code so signInForm.tsx can show a passkey-specific message
// instead of the password-flow's generic "Invalid email or password."
class PasskeySignInError extends CredentialsSignin {
  code = "passkey_failed";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Google,
    Apple,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = SignInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // A5/A7: forward the real client IP so the backend's DB-backed
        // limiter (survives serverless cold starts, unlike the old
        // in-memory Map here) can key on it. This is best-effort — a caller
        // hitting the backend directly could claim any IP — but the
        // per-email lockout the backend also enforces doesn't depend on it,
        // so brute-forcing a specific account is still blocked regardless.
        const clientIp =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown";

        try {
          const res = await callBackend(
            "/auth/login",
            { email, password },
            { "X-Client-Ip": clientIp }
          );
          if (res.status === 429) {
            throw new LoginRateLimitedError();
          }
          if (!res.ok) {
            return null;
          }
          const user = await res.json();
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as AppUserRole,
            emailVerified: user.email_verified ? new Date() : null,
          };
        } catch (err) {
          if (err instanceof LoginRateLimitedError) throw err;
          return null;
        }
      },
    }),
    // Usernameless passkey sign-in. A second Credentials-type provider (not
    // NextAuth's built-in `type: "webauthn"` provider, which expects a full
    // Adapter implementing authenticator storage — this app has no NextAuth
    // Adapter at all, the FastAPI backend owns all persistence, same as the
    // password provider above) — its `authorize()` just hands an
    // already-completed WebAuthn assertion to the backend for verification,
    // exactly like the password provider hands it a password.
    Credentials({
      id: "passkey",
      name: "Passkey",
      credentials: {
        challengeId: { label: "challengeId", type: "text" },
        credential: { label: "credential", type: "text" },
      },
      async authorize(credentials) {
        const challengeId = credentials?.challengeId;
        const credentialJson = credentials?.credential;
        if (typeof challengeId !== "string" || typeof credentialJson !== "string") {
          return null;
        }

        let credential: unknown;
        try {
          credential = JSON.parse(credentialJson);
        } catch {
          return null;
        }

        try {
          const res = await callBackend("/auth/webauthn/authenticate/verify", {
            challengeId,
            credential,
          });
          if (res.status === 429) {
            throw new LoginRateLimitedError();
          }
          if (!res.ok) {
            throw new PasskeySignInError();
          }
          const user = await res.json();
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as AppUserRole,
            emailVerified: user.email_verified ? new Date() : null,
          };
        } catch (err) {
          if (err instanceof LoginRateLimitedError || err instanceof PasskeySignInError) throw err;
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async redirect({ url, baseUrl }) {
      return isSafeCallbackUrl(url) ? new URL(url, baseUrl).toString() : baseUrl;
    },

    async jwt({ token, user, account, profile, trigger }) {
      if (user && account) {
        // A10 follow-up: stamped once, at genuine sign-in, only — never
        // touched again for the life of this session (not even on the
        // trigger === "update" refresh below). This is what lets the
        // backend tell "a session established before the user's last
        // password reset" apart from "a session established after it".
        token.sessionIssuedAt = Math.floor(Date.now() / 1000);

        if (account.type !== "credentials") {
          // A3: only trust the OAuth email as verified if the provider's own
          // profile/ID-token claim says so (Google/Apple both expose
          // `email_verified`, sometimes as the string "true"). The backend
          // uses this to decide whether it's safe to auto-link to an
          // existing password account — see upsert_oauth_user.
          const rawEmailVerified = (profile as { email_verified?: boolean | string } | undefined)
            ?.email_verified;
          const providerEmailVerified = rawEmailVerified === true || rawEmailVerified === "true";

          // OAuth: sync with FastAPI backend to get our internal user ID + role
          const synced = await syncOAuthUser(user, account, providerEmailVerified);
          if (!synced) {
            return null as unknown as typeof token; // deny sign-in if backend sync fails
          }
          token.id = synced.id;
          token.role = synced.role;
          token.emailVerified = synced.emailVerified;
        } else {
          token.id = user.id;
          token.role = (user as { role?: AppUserRole }).role;
          token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified != null;
        }
        token.name = user.name;
        token.email = user.email;
      }

      if (trigger === "update" && token.id) {
        // A8: re-fetch canonical account state from the backend instead of
        // blindly merging the client-supplied `session` object into the
        // token — trusting it as-is would let any caller of
        // useSession().update({...}) set emailVerified/role themselves.
        // Triggered by the verify-email page after a successful backend
        // verification, so a user doesn't have to fully re-login for their
        // session to reflect it.
        try {
          const userId = token.id as string;
          const res = await fetch(
            `${getBackendApiBaseUrl()}/auth/profile/${userId}`,
            {
              headers: {
                "X-Internal-Api-Key": getBackendInternalApiKey(),
                "X-Actor-User-Id": userId,
                // A2: the backend only trusts a signed actor token, not the
                // plain header above (kept for log correlation only).
                "X-Actor-Token": await mintActorToken({
                  id: userId,
                  role: (token.role as string) ?? "customer",
                  sessionIssuedAt: token.sessionIssuedAt as number | undefined,
                }),
              },
              cache: "no-store",
              signal: AbortSignal.timeout(5000),
            }
          );
          if (res.ok) {
            const profile = await res.json();
            token.emailVerified = Boolean(profile.email_verified);
            token.role = profile.role as AppUserRole;
          }
        } catch {
          // Keep the existing token state on a refresh failure — don't let a
          // transient backend hiccup invalidate the current session.
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as AppUserRole;
        session.user.name = (token.name as string | undefined) ?? session.user.name;
        session.user.email = (token.email as string | undefined) ?? session.user.email;
        session.user.emailVerified = token.emailVerified
          ? new Date()
          : null;
        session.user.sessionIssuedAt = token.sessionIssuedAt as number | undefined;
      }
      return session;
    },
  },

});
