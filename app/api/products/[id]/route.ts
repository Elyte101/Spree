import { proxyBackend } from "@/lib/serverApi";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackend(`/products/${id}`);
}
