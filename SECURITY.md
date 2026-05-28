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
| Rate limiting | In-memory per-email (login, via middleware wrapping the NextAuth credentials callback) and per-IP (signup); 5 attempts → 15-minute lockout; returns `429 Retry-After`. |
| Open-redirect | `callbackUrl` validated via `isSafeCallbackUrl()` (scheme-prefix regex + WHATWG URL origin check against `http://placeholder.invalid`); only relative paths accepted. |
| Auth error page | `/auth/error` renders a fixed generic message; `?error=` query param is never echoed into the DOM. |
| Content-Security-Policy | Report-Only mode (see `next.config.ts`); flip to enforcement once tested |
| Transport | HSTS with 2-year max-age, `includeSubDomains`, `preload` |
| Clickjacking | `frame-ancestors 'none'` CSP directive + `X-Frame-Options` via COOP/CORP headers |
| Content sniffing | `X-Content-Type-Options: nosniff` |
| localStorage | Stores only product IDs and UI filter state — no tokens or PII |

## Out of Scope

- Vulnerabilities in third-party dependencies (report upstream)
- Attacks requiring physical device access
- Social engineering
