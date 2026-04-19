import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  return proxyBackend("/home");
}
