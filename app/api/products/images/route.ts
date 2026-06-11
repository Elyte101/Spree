import "server-only";

import { auth } from "@/auth";
import { canCreateProductsRole } from "@/lib/roles";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "product-images";

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function supabaseUrl(): string {
  const url = process.env.DATABASE_SUPABASE_URL;
  if (!url) throw new Error("DATABASE_SUPABASE_URL not set");
  return url.replace(/\/GH₵/, "");
}

function serviceRoleKey(): string {
  const key = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("DATABASE_SUPABASE_SERVICE_ROLE_KEY not set");
  return key;
}

async function ensureBucket(base: string, key: string): Promise<void> {
  const res = await fetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: MAX_BYTES }),
  });
  // 400 means bucket already exists — that's fine
  if (!res.ok && res.status !== 400) {
    const text = await res.text();
    throw new Error(`Bucket setup failed: ${res.status} ${text}`);
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session || !canCreateProductsRole(session.user.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid multipart request" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const mime = file.type.toLowerCase().split(";")[0].trim();
  if (!ALLOWED_TYPES.has(mime)) {
    return Response.json({ error: "Only JPEG, PNG, and WebP images are accepted" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File must be under 5 MB" }, { status: 413 });
  }

  let base: string;
  let key: string;
  try {
    base = supabaseUrl();
    key = serviceRoleKey();
  } catch {
    return Response.json({ error: "Storage not configured" }, { status: 503 });
  }

  try {
    await ensureBucket(base, key);
  } catch (err) {
    console.error("[product-images] ensureBucket:", err);
    return Response.json({ error: "Storage setup failed" }, { status: 503 });
  }

  const ext = EXT[mime];
  const path = `${session.user.id}/${crypto.randomUUID()}${ext}`;
  const bytes = await file.arrayBuffer();

  const upload = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": mime },
    body: bytes,
  });

  if (!upload.ok) {
    const text = await upload.text();
    console.error("[product-images] upload failed:", upload.status, text);
    return Response.json({ error: "Upload failed" }, { status: 502 });
  }

  const url = `${base}/storage/v1/object/public/${BUCKET}/${path}`;
  return Response.json({ url });
}
