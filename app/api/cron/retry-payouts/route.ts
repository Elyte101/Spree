import "server-only";
import { NextRequest } from "next/server";

/**
 * Hourly cron: retry Paystack transfers for orders stuck in "confirmed" state
 * because a previous payout attempt failed or the seller had no payout account.
 *
 * Safe to retry — the backend uses idempotency keys to prevent double-payment.
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

  const res = await fetch(`${getBackendApiBaseUrl()}/cron/retry-payouts`, {
    method: "POST",
    headers: {
      "X-Internal-Api-Key": getBackendInternalApiKey(),
      "X-Actor-Role": "system",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[cron/retry-payouts] backend error:", res.status, text);
    return Response.json({ error: "Backend error" }, { status: 502 });
  }

  const data = await res.json();
  return Response.json(data);
}
