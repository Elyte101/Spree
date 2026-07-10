import { NextRequest } from "next/server";

import { proxyBackend } from "@/lib/serverApi";

// Used only by the "webauthn" NextAuth Credentials provider (auth.ts) via a
// direct backend call — this Next route exists for completeness/parity with
// the other three passkey endpoints, and to test the endpoint independently
// of the NextAuth ceremony, but the sign-in flow itself does not call it.
export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const body = await request.text();

  return proxyBackend(
    "/auth/webauthn/authenticate/verify",
    {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json", "X-Client-Ip": clientIp },
    },
    { internal: true }
  );
}
