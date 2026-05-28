/**
 * Returns true only for same-site relative paths.
 *
 * Uses new URL(input, 'http://placeholder.invalid') and asserts the
 * parsed origin remains the placeholder — meaning the input carried no
 * scheme or authority of its own.  Explicit leading checks reject the
 * protocol-relative ("//evil") and backslash-relative ("\\evil") forms
 * that some URL parsers silently normalise before the origin check fires.
 */
export function isSafeCallbackUrl(url: string): boolean {
  if (!url) return false;
  // Reject protocol-relative and backslash-relative forms
  if (url.startsWith("//") || url.startsWith("\\")) return false;
  // Reject anything that begins with a scheme (including malformed "http:/evil.com").
  // RFC 3986 scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(url)) return false;
  try {
    const parsed = new URL(url, "http://placeholder.invalid");
    return parsed.origin === "http://placeholder.invalid";
  } catch {
    return false;
  }
}
