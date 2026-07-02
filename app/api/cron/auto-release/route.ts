import "server-only";
import { NextRequest } from "next/server";

/**
 * G10: Auto-release cron endpoint.
 *
 * Triggers the backend to auto-confirm orders that have been in 'delivered' status
 * for longer than the `auto_release_days` SiteSetting (default: 7 days) without
 * the buyer confirming receipt.  The backend then releases the seller payout.
 *
 * Schedule: daily (e.g. "0 2 * * *" in vercel.json cron config).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { getBackendApiBaseUrl, getBackendInternalApiKey } = await import(
    "@/lib/runtimeConfig"
  );

  const res = await fetch(`${getBackendApiBaseUrl()}/cron/auto-release`, {
    method: "POST",
    headers: {
      "X-Internal-Api-Key": getBackendInternalApiKey(),
      "X-Actor-Role": "system",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[cron/auto-release] backend error:", res.status, text);
    return Response.json({ error: "Backend error" }, { status: 502 });
  }

  const data = await res.json();
  return Response.json(data);
}
