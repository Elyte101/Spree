import { NextRequest } from "next/server";

import { proxyBackend } from "@/lib/serverApi";

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  return proxyBackend(
    "/auth/webauthn/authenticate/options",
    { method: "POST", headers: { "X-Client-Ip": clientIp } },
    { internal: true }
  );
}
