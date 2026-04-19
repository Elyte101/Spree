import { proxyBackend } from "@/lib/serverApi";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { search } = new URL(request.url);
  return proxyBackend(`/products/${id}/related${search}`);
}
