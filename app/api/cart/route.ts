import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  return proxyBackend("/cart", undefined, { internal: true });
}
