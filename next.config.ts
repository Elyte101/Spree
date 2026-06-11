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
  // In production, switch to a nonce-based approach once SSR-nonce support
  // is added to the Emotion cache.
  "style-src 'self' 'unsafe-inline'",
  // 'unsafe-eval' is only allowed in dev (Next.js HMR uses eval).
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : "script-src 'self'",
  // next/image serves optimised images from /_next; allow the CDN origin and
  // any https: image host declared in remotePatterns.
  "img-src 'self' data: blob: https:",
  // Connect: our own origin + the backend API origin.
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}`,
  // Prevent framing / clickjacking.
  "frame-ancestors 'none'",
  // Restrict base element and form submissions to same-origin.
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  // Keep CSP in report-only until the directive list is validated.
  // Switch key to "Content-Security-Policy" for enforcement.
  { key: "Content-Security-Policy-Report-Only", value: cspValue },
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
    remotePatterns: [
      { protocol: "https", hostname: "api.escuelajs.co" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "placeimg.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },

  async headers() {
    return [
      {
        // Apply to every route.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
