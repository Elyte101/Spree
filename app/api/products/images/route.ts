import "server-only";

import sharp from "sharp";
import { auth } from "@/auth";
import { canCreateProductsRole } from "@/lib/roles";

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "product-images";

type WebFormat = "jpeg" | "png" | "webp";
type SniffResult = WebFormat | "heic" | "tiff" | "unknown";

/**
 * Detect the actual image format from magic bytes, not the browser-reported
 * MIME type. This catches HEIC files renamed to .jpg (common on iOS).
 */
function sniffFormat(buf: Uint8Array): SniffResult {
  if (buf.length < 12) return "unknown";
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "jpeg";
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "png";
  // WebP: RIFF .... WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "webp";
  // HEIC/HEIF: ISO Base Media (ftyp box starting at byte 4)
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "heic";
  // TIFF: little-endian (II) or big-endian (MM)
  if ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2A && buf[3] === 0x00) ||
      (buf[0] === 0x4D && buf[1] === 0x4D && buf[2] === 0x00 && buf[3] === 0x2A)) return "tiff";
  return "unknown";
}

const EXT: Record<WebFormat, string> = {
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
};

const CONTENT_TYPE: Record<WebFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function supabaseUrl(): string {
  const url = process.env.DATABASE_SUPABASE_URL;
  if (!url) throw new Error("DATABASE_SUPABASE_URL not set");
  return url.replace(/\/$/, "");
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
  if (file.size === 0) {
    return Response.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File must be under 5 MB" }, { status: 413 });
  }

  const rawBytes = await file.arrayBuffer();
  const sniffed = sniffFormat(new Uint8Array(rawBytes));

  let finalFormat: WebFormat;
  let finalBytes: Uint8Array;

  if (sniffed === "jpeg" || sniffed === "png" || sniffed === "webp") {
    // Recognised web format — pass through as-is
    finalFormat = sniffed;
    finalBytes = new Uint8Array(rawBytes);
  } else if (sniffed === "heic" || sniffed === "tiff") {
    // Non-web format (HEIC from iOS, TIFF from scanners/pro cameras) — convert to JPEG
    console.log(`[product-images] converting ${sniffed.toUpperCase()} → JPEG for ${file.name}`);
    try {
      const buf = await sharp(Buffer.from(rawBytes)).jpeg({ quality: 90 }).toBuffer();
      finalBytes = new Uint8Array(buf);
      finalFormat = "jpeg";
    } catch (err) {
      console.error("[product-images] sharp conversion failed:", err);
      return Response.json(
        { error: "Could not convert image. Please export as JPEG, PNG, or WebP and try again." },
        { status: 422 }
      );
    }
  } else {
    // Unknown or unsupported format
    return Response.json(
      { error: "Only JPEG, PNG, WebP, and HEIC images are accepted" },
      { status: 400 }
    );
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

  const path = `${session.user.id}/${crypto.randomUUID()}${EXT[finalFormat]}`;

  const upload = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": CONTENT_TYPE[finalFormat],
    },
    body: finalBytes.buffer as ArrayBuffer,
  });

  if (!upload.ok) {
    const text = await upload.text();
    console.error("[product-images] upload failed:", upload.status, text);
    return Response.json({ error: "Upload failed" }, { status: 502 });
  }

  const url = `${base}/storage/v1/object/public/${BUCKET}/${path}`;
  return Response.json({ url });
}
