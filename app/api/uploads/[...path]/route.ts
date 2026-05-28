import "server-only";
import { auth } from "@/auth";
import { getBackendStaticBaseUrl } from "@/lib/runtimeConfig";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const { path } = await params;
  const url = `${getBackendStaticBaseUrl()}/uploads/${path.join("/")}`;

  try {
    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok) {
      return new Response("Not found", { status: 404 });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Upstream error", { status: 502 });
  }
}
