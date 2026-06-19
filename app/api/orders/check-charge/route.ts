
import { auth } from "@/auth";
import { unauthorized } from "@/lib/errors";
import { proxyBackend } from "@/lib/serverApi";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference");
  if (!reference) {
    return new Response(JSON.stringify({ detail: "reference is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return proxyBackend(
    `/orders/check-charge?reference=${encodeURIComponent(reference)}`,
    { method: "GET" },
    { internal: true }
  );
}
