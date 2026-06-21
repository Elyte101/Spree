import "server-only";
import { auth } from "@/auth";

const BUCKET = "seller-documents";

function supabaseBase(): string {
  const url = process.env.DATABASE_SUPABASE_URL;
  if (!url) throw new Error("DATABASE_SUPABASE_URL not set");
  return url.replace(/\/$/, "");
}

function serviceKey(): string {
  const key = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("DATABASE_SUPABASE_SERVICE_ROLE_KEY not set");
  return key;
}

async function signedReadUrl(base: string, key: string, path: string): Promise<string | null> {
  if (!path) return null;

  // Extract the object path from a full URL (in case we stored the full URL)
  const bucketMarker = `/storage/v1/object/public/${BUCKET}/`;
  const storagePath = path.includes(bucketMarker)
    ? path.split(bucketMarker)[1]
    : path.replace(`${BUCKET}/`, "");

  const res = await fetch(
    `${base}/storage/v1/object/sign/${BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 120 }),
    }
  );
  if (!res.ok) return null;
  const { signedURL } = await res.json();
  return signedURL ? `${base}${signedURL}` : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Fetch the seller detail from the backend to get stored paths
  const { getBackendApiBaseUrl, getBackendInternalApiKey } = await import("@/lib/runtimeConfig");
  const backendRes = await fetch(
    `${getBackendApiBaseUrl()}/admin/sellers/${id}`,
    {
      headers: {
        "X-Internal-Api-Key": getBackendInternalApiKey(),
        "X-Actor-Role": "admin",
      },
      cache: "no-store",
    }
  );
  if (!backendRes.ok) {
    return Response.json({ error: "seller not found" }, { status: backendRes.status });
  }
  const seller = await backendRes.json();

  let base: string, key: string;
  try {
    base = supabaseBase();
    key = serviceKey();
  } catch {
    // Return stored URLs as-is if Supabase not configured (dev fallback)
    return Response.json({
      idFrontUrl: seller.idFrontUrl || null,
      idBackUrl: seller.idBackUrl || null,
      selfieUrl: seller.selfieUrl || null,
    });
  }

  const [idFrontUrl, idBackUrl, selfieUrl] = await Promise.all([
    signedReadUrl(base, key, seller.idFrontUrl),
    signedReadUrl(base, key, seller.idBackUrl),
    signedReadUrl(base, key, seller.selfieUrl),
  ]);

  return Response.json({ idFrontUrl, idBackUrl, selfieUrl });
}
