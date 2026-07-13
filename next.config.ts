import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// ---------------------------------------------------------------------------
// Content-Security-Policy
// Started in Report-Only mode so violations surface in DevTools / Sentry
// without breaking pages. Flip to "Content-Security-Policy" once the
// directive list has been tested in production.
// ---------------------------------------------------------------------------
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "";

const cspValue = [
  "default-src 'self'",
  // MUI / Emotion require 'unsafe-inline' for injected <style> tags.
  // https://paystack.com is where Paystack Inline's own script injects its
  // checkout-button stylesheet from (confirmed by inspecting js.paystack.co's
  // source). In production, switch to a nonce-based approach once SSR-nonce
  // support is added to the Emotion cache.
  "style-src 'self' 'unsafe-inline' https://paystack.com",
  // 'unsafe-eval'/'unsafe-inline' are only allowed in dev (Next.js HMR uses
  // eval). js.paystack.co is Paystack Inline's checkout script
  // (components/checkout/checkoutPage.tsx) — required in both envs so
  // checkout can be exercised locally too. va.vercel-scripts.com is
  // @vercel/analytics's <Analytics /> component (app/layout.tsx) — in
  // production it loads from a same-origin path Vercel's edge rewrites
  // (already covered by 'self'), but in dev it loads script.debug.js from
  // this external host directly, confirmed via a live securitypolicyviolation
  // check — without it, local dev always reports a violation.
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.paystack.co https://va.vercel-scripts.com"
    : "script-src 'self' https://js.paystack.co https://va.vercel-scripts.com",
  // next/image serves optimised images from /_next (same-origin) for the
  // common case; the remaining hosts cover ProductImage's unoptimized-retry
  // fallback (components/ui/productImage.tsx), which loads the raw remote
  // URL directly in the browser after two failed optimizer attempts:
  //   - https://*.supabase.co: vendor-uploaded product images
  //   - https://placehold.co: seed/category placeholder images (backend/app/seeds/catalog.py)
  //   - blob:: local image previews before upload (productCreateForm.tsx's URL.createObjectURL)
  "img-src 'self' data: blob: https://*.supabase.co https://placehold.co",
  // Connect: our own origin (all backend calls are proxied through same-origin
  // Next.js API routes — NEXT_PUBLIC_API_URL/apiOrigin is unset in practice,
  // kept only in case a direct client-side backend call is ever added) +
  // Stream Chat's REST/WebSocket API (components/providers/chatProvider.tsx,
  // components/admin/AdminChatPage.tsx — this app's actual realtime feature;
  // there is no Supabase Realtime usage anywhere in the codebase) + Paystack's
  // API (called by the injected js.paystack.co script during checkout).
  `connect-src 'self' https://chat.stream-io-api.com wss://chat.stream-io-api.com https://api.paystack.co${apiOrigin ? ` ${apiOrigin}` : ""}`,
  // Paystack Inline renders its checkout form in an iframe (confirmed via
  // .openIframe() in checkoutPage.tsx and by inspecting js.paystack.co's source).
  "frame-src https://checkout.paystack.com https://paystack.com",
  // Prevent framing / clickjacking (belt-and-suspenders with X-Frame-Options
  // below — CSP frame-ancestors is the modern replacement, but this is still
  // Report-Only, so X-Frame-Options is what actually enforces it today).
  "frame-ancestors 'none'",
  // Restrict base element and form submissions to same-origin.
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  // Still Report-Only: Next.js's own RSC hydration payload is delivered via
  // inline <script> tags with no nonce infrastructure set up yet (see the
  // style-src comment above), so enforcing `script-src 'self'` as-is would
  // break hydration in production. X-Frame-Options below is what actually
  // closes the clickjacking gap today; switch this key to
  // "Content-Security-Policy" once nonce-based script-src lands and the
  // directive list has been validated against real traffic.
  { key: "Content-Security-Policy-Report-Only", value: cspValue },
  // Real, enforcing clickjacking protection — independent of the CSP above.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Remove the "X-Powered-By: Next.js" header to avoid fingerprinting.
  poweredByHeader: false,

  allowedDevOrigins: ["127.0.0.1", "localhost"],

  images: {
    // Cache optimised image variants for 1 year. The default 60 s causes
    // the optimizer to re-process the same image on nearly every request.
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: "https", hostname: "api.escuelajs.co" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "placeimg.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },

  async headers() {
    return [
      {
        // Apply to every route.
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Auth/session responses already send Cache-Control: private,
        // no-cache, no-store — Vary: Cookie is additional caching hygiene so
        // any intermediary that doesn't fully respect Cache-Control still
        // keys on the session cookie rather than risking a cross-user hit.
        source: "/api/auth/:path*",
        headers: [{ key: "Vary", value: "Cookie" }],
      },
    ];
  },
};

export default nextConfig;
