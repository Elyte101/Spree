// Static HTML route — no RSC payload, so the response is byte-identical
// regardless of which ?error= value NextAuth appended to the redirect URL.
// This prevents the App Router's RSC serialization from leaking the error code
// into the response body.
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in failed | Spree</title>
  <meta name="robots" content="noindex" />
</head>
<body style="margin:0;background:#fff;color:#0f172a;font-family:system-ui,sans-serif;">
  <main style="min-height:100vh;display:grid;place-items:center;padding:2rem;">
    <div style="text-align:center;max-width:400px;">
      <h2 style="margin:0 0 0.75rem;font-size:1.5rem;font-weight:900;">Sign in failed</h2>
      <p style="color:#666;margin:0 0 1.5rem;">
        We couldn't sign you in. Please try again or contact support if the problem persists.
      </p>
      <a
        href="/auth/sign-in"
        style="display:inline-block;padding:0.75rem 1.5rem;background:#655AFF;color:#fff;border-radius:999px;text-decoration:none;font-weight:700;font-size:0.95rem;"
      >Back to sign in</a>
    </div>
  </main>
</body>
</html>`;

export function GET() {
  return new Response(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
