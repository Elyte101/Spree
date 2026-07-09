# Authentication Audit — 2026-07-09

Scope: NextAuth (auth.ts, auth.config.ts), proxy.ts middleware, lib/rateLimit.ts, lib/serverApi.ts trust model, backend auth service/routes, signup/login/email-verification/OAuth, password policy.

Architecture: NextAuth (JWT sessions) on the Next side. Next server routes call FastAPI with a shared `X-Internal-Api-Key` and pass `X-Actor-User-Id`/`X-Actor-Role` headers derived server-side from the session. FastAPI trusts those headers for authorization.

Severity: C = critical, H = high, M = medium.

## Critical

### A1 — Default auth secret is hardcoded and silently used
`auth.config.ts`: `secret: … ?? "spree-dev-secret-change-me"`. If `NEXTAUTH_SECRET`/`AUTH_SECRET` is unset in any environment, JWTs are signed with a publicly-known secret — anyone can forge a session token with `role: "admin"` and take over the platform. The fallback means this fails open, not closed.
**Fix:** remove the fallback; require the env var and throw at startup if missing (in production). Fail closed.

### A2 — Backend authorization trusts spoofable identity headers with no defense in depth
FastAPI derives the entire actor identity from `X-Actor-User-Id`/`X-Actor-Role`, gated only by the shared internal key. This is safe *only* as long as (a) the internal key never leaks and (b) the backend is never reachable except through the Next proxy. Both are single points of failure: the backend is deployed publicly (`backend/vercel.json`), and any handler that forwards a client-influenced role, or any internal-key leak, yields instant admin. There is no signature/JWT binding the actor headers to a real authenticated session.
**Fix:** have the backend independently verify a short-lived signed token (e.g. the NextAuth JWT, or a backend-minted HS256 token) that carries user id + role, instead of trusting raw headers. At minimum: network-restrict the backend so only the Next deployment can reach it, and add a startup check that refuses to boot with a default/short internal key.

### A3 — OAuth sign-in auto-links to any existing account by email (account takeover)
`upsert_oauth_user`: if a user with the same email exists, it attaches the OAuth provider and sets `email_verified = True` with no verification that the OAuth email is controlled by the same person and no existing-password challenge. An attacker who creates a Google account with a victim's email address (or where email ownership isn't guaranteed) can link into the victim's existing password account. Also: Google/Apple providers are enabled but there's no check on `email_verified` from the provider profile.
**Fix:** only auto-link when the OAuth provider asserts a verified email AND either the local account has no password or the user proves ownership. Otherwise create/deny explicitly. Verify the provider's `email_verified` claim.

## High

### A4 — Email verification is never enforced anywhere
`email_verified` is captured and threaded into the session but nothing gates on it. Unverified users can log in, onboard as sellers, checkout, and post comments. The whole verification flow is cosmetic.
**Fix:** decide the policy (block unverified from sensitive actions — seller onboarding, checkout, posting — or block login entirely) and enforce it server-side in the backend, not just the UI.

### A5 — Login/rate-limit state is per-instance in-memory (bypassable on serverless)
`lib/rateLimit.ts` uses a module `Map` + `setInterval`. On Vercel each invocation may be a fresh instance, so the 5-attempts/15-min brute-force lockout resets constantly and is effectively absent in production. Same serverless-state class as prior audit findings. The IP key is also a constant string `"login-ip:server"` — it rate-limits ALL users collectively, not per IP, so one attacker can lock out every user, and per-IP limiting doesn't actually happen.
**Fix:** move login rate limiting to the shared DB (reuse backend `RateLimitEvent`), key it per email AND per real client IP, and enforce it in the backend `/auth/login` handler so it can't be skipped by calling the backend directly.

### A6 — No password reset / forgot-password flow exists
There is no way to reset a forgotten password. Users locked out are stranded; support has no mechanism. Also increases the chance of password reuse across accounts.
**Fix:** add a token-based password reset (request → emailed one-time token with short expiry → set new password), reusing the VerificationToken pattern and Resend. Invalidate sessions on reset.

### A7 — Login response doesn't distinguish lockout from bad credentials, and rate limiter never blocks the backend
`authorize()` returns `null` for everything (good for enumeration resistance) but the lockout is only checked on the Next side; the backend `/auth/login` has no rate limiting at all. An attacker calling the backend directly (see A2) has unlimited attempts. Additionally `checkRateLimit` is checked but a successful call path never surfaces `retryAfter`, so users get no lockout feedback.
**Fix:** enforce rate limiting in the backend login handler (A5); keep generic client messaging but log lockouts server-side.

## Medium

### A8 — `emailVerified` in JWT can't be refreshed after verification
The flag is set at login time into the JWT. A user who verifies their email *after* logging in keeps `emailVerified: false` in their session until they fully re-login (token refresh via `trigger === "update"` isn't wired to re-fetch it). Combined with A4 this is latent, but will bite once A4 is enforced.
**Fix:** re-read verification status on session update, or force a token refresh after verification completes.

### A9 — No CSRF/origin hardening on the state-changing proxy routes beyond NextAuth defaults; OAuth `redirect` callback relies solely on `isSafeCallbackUrl`
Confirm `isSafeCallbackUrl` rejects protocol-relative (`//evil.com`) and absolute external URLs. The `jwt` callback returns `null as unknown as typeof token` to deny OAuth when backend sync fails — verify this actually denies sign-in rather than producing a broken half-session.
**Fix:** unit-test `isSafeCallbackUrl` against `//evil.com`, `https://evil.com`, `/\evil.com`, `javascript:`; assert the OAuth-sync-failure path denies cleanly.

### A10 — Session/token lifetime and revocation
JWT strategy means sessions can't be server-revoked before expiry. No `maxAge` is set (defaults to 30 days). A blacklisted/soft-deleted seller (marketplace `delete_seller`) keeps a valid session and role until the JWT expires — the backend should re-check user status on sensitive actions, not trust the role baked into the token.
**Fix:** set a shorter session `maxAge` + rolling refresh; on sensitive/admin actions, re-validate the user's current status/role from the DB rather than the token.

### A11 — Password policy: 8-char minimum, no breach check, no max length
`_validate_password_strength` requires lower/upper/digit/symbol and len ≥ 8. Reasonable but: no maximum length cap (scrypt DoS via huge inputs), no check against common/breached passwords, and the composition rule frustrates passphrases. Consider aligning with NIST (length-first, block common passwords, cap at e.g. 128 chars).

## Verified OK
scrypt hashing with constant-time compare (core/security.py); login is generic-error (no user enumeration on the Next side); admin routes re-check `session.user.role === "admin"` in the Next route before proxying; profile GET/PUT enforce `actor_id == user_id or admin`; payout-info enforces self-only; internal key uses `secrets.compare_digest`; onboarding steps gated by actor id.
