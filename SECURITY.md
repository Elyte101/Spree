# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Spree, please report it **privately** by emailing the team at **security@spree.com** (do not open a public GitHub issue).

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Affected components or files, if known

We aim to acknowledge reports within **48 hours** and provide a fix timeline within **7 days** for critical issues.

## Security Architecture

| Control | Implementation |
|---|---|
| Auth | NextAuth v4 JWT, httpOnly cookies, `__Secure-` / `__Host-` prefixes in production |
| Payments | Paystack hosted redirect — the checkout UI shows **no card inputs**. After filling address/delivery details, the buyer is redirected to Paystack's PCI-DSS compliant page. No PAN, CVC, or expiry ever enters our DOM or our servers. |
| CSRF | NextAuth built-in CSRF token (`__Host-next-auth.csrf-token`) |
| Rate limiting | In-memory per-email (login, via `app/api/auth/[...nextauth]/route.ts` wrapping the NextAuth credentials callback) and per-IP (signup); 5 attempts → 15-minute lockout; returns `429 Retry-After`. |
| Open-redirect | `callbackUrl` validated via `isSafeCallbackUrl()` (scheme-prefix regex + WHATWG URL origin check against `http://placeholder.invalid`); only relative paths accepted. |
| Auth error page | `/auth/error` is a static route handler (`app/auth/error/route.ts`) returning byte-identical HTML for all inputs; `proxy.ts` strips `?error=` before routing and logs the error code server-side only. |
| Content-Security-Policy | Report-Only mode (see `next.config.ts`); flip to enforcement once tested |
| Transport | HSTS with 2-year max-age, `includeSubDomains`, `preload` |
| Clickjacking | `frame-ancestors 'none'` CSP directive + `X-Frame-Options` via COOP/CORP headers |
| Content sniffing | `X-Content-Type-Options: nosniff` |
| localStorage | Stores only product IDs and UI filter state — no tokens or PII |

## Backend Unavailability Behavior

When the FastAPI backend is unreachable (ECONNREFUSED, timeout, etc.), the Next.js route handlers intentionally return:

```json
HTTP 503
{"detail":"Some store details are unavailable right now, but you can still keep browsing."}
```

This is expected, graceful-degradation behavior, not a vulnerability. The response:
- Uses a fixed message — no internal error details, stack traces, or upstream URLs are exposed to the caller.
- Is logged server-side as `{"event":"upstream_unreachable","url":"...","code":"...","message":"..."}`.
- Is de-duplicated per path — each unique upstream URL is logged at most once per process lifetime to prevent log flooding.
- Times out after **5 seconds** (`AbortSignal.timeout(5000)` in `lib/serverApi.ts`) so a slow backend does not hang the Next.js worker.

## Out of Scope

- Vulnerabilities in third-party dependencies (report upstream)
- Attacks requiring physical device access
- Social engineering
