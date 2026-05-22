import { proxyBackend } from "@/lib/serverApi";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference") ?? "";
  return proxyBackend(
    `/orders/verify-payment?reference=${encodeURIComponent(reference)}`,
    {},
    { internal: true }
  );
}
