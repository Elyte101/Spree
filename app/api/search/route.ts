import { proxyBackend } from "@/lib/serverApi";

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  return proxyBackend(`/search${search}`);
}
