import "server-only";
import { auth } from "@/auth";

const BUCKET = "vendor-documents";
const ALLOWED_SLOTS = new Set(["logo"]);

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

async function ensureBucket(base: string, key: string): Promise<void> {
  const res = await fetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: false,
      file_size_limit: 10 * 1024 * 1024,
    }),
  });
  // 400 = already exists
  if (!res.ok && res.status !== 400) {
    throw new Error(`Bucket setup failed: ${res.status}`);
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let slot: string;
  try {
    const body = await request.json();
    slot = body?.slot ?? "";
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!ALLOWED_SLOTS.has(slot)) {
    return Response.json({ error: "Invalid slot" }, { status: 400 });
  }

  let base: string, key: string;
  try {
    base = supabaseBase();
    key = serviceKey();
  } catch {
    return Response.json({ error: "Storage not configured" }, { status: 503 });
  }

  try {
    await ensureBucket(base, key);
  } catch (err) {
    console.error("[upload-url] ensureBucket:", err);
    return Response.json({ error: "Storage setup failed" }, { status: 503 });
  }

  const path = `${session.user.id}/${slot}_${crypto.randomUUID()}.jpg`;

  // Generate a signed upload URL (60 seconds)
  const signRes = await fetch(
    `${base}/storage/v1/object/upload/sign/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 60 }),
    }
  );

  if (!signRes.ok) {
    const text = await signRes.text();
    console.error("[upload-url] sign failed:", signRes.status, text);
    return Response.json({ error: "Could not generate upload URL" }, { status: 502 });
  }

  const { signedURL } = await signRes.json();

  // Public URL won't work since bucket is private — return a separate admin-read URL
  return Response.json({
    uploadUrl: `${base}${signedURL}`,
    path,
    bucket: BUCKET,
  });
}
