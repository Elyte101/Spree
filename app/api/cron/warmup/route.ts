import "server-only";
import { NextRequest } from "next/server";

// Pings the backend health endpoint to prevent cold starts.
// Runs every 5 minutes (see vercel.json cron schedule).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { getBackendApiBaseUrl } = await import("@/lib/runtimeConfig");

  try {
    const res = await fetch(`${getBackendApiBaseUrl()}/healthz`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    return Response.json({ ok: res.ok, status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[cron/warmup] backend unreachable:", message);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
