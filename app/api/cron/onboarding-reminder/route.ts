import "server-only";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Vercel cron jobs send a Authorization header with CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { getBackendApiBaseUrl, getBackendInternalApiKey } = await import("@/lib/runtimeConfig");
  const res = await fetch(`${getBackendApiBaseUrl()}/cron/onboarding-reminder`, {
    method: "POST",
    headers: {
      "X-Internal-Api-Key": getBackendInternalApiKey(),
      "X-Actor-Role": "system",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[cron/onboarding-reminder] backend error:", res.status, text);
    return Response.json({ error: "Backend error" }, { status: 502 });
  }

  const data = await res.json();
  return Response.json(data);
}
