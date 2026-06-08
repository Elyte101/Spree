import "server-only";
import { auth } from "@/auth";
import { getBackendInternalApiKey, getBackendStaticBaseUrl } from "@/lib/runtimeConfig";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session) {
    return new Response("Forbidden", { status: 403 });
  }

  const { path } = await params;
  // The first path segment is the user ID that owns the document.
  // Allow the owning user or any admin; no one else.
  const ownerId = path[0] ?? "";
  const isAdmin = session.user.role === "admin";
  const isOwner = session.user.id === ownerId;
  if (!isAdmin && !isOwner) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = `${getBackendStaticBaseUrl()}/uploads/${path.join("/")}`;

  try {
    const upstream = await fetch(url, {
      cache: "no-store",
      headers: {
        "X-Internal-Api-Key": getBackendInternalApiKey(),
        "X-Actor-User-Id": session.user.id,
        "X-Actor-Role": session.user.role,
      },
    });
    if (!upstream.ok) {
      return new Response("Not found", { status: 404 });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Upstream error", { status: 502 });
  }
}
