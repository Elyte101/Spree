import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { auth } from "@/auth";
import { canCreateProductsRole } from "@/lib/roles";

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "product-images";

type WebFormat = "jpeg" | "png" | "webp";
type SniffResult = WebFormat | "heic" | "tiff" | "unknown";

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

function sniffFormat(buf: Uint8Array): SniffResult {
  if (buf.length < 12) return "unknown";
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "webp";
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "heic";
  if ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2A && buf[3] === 0x00) ||
      (buf[0] === 0x4D && buf[1] === 0x4D && buf[2] === 0x00 && buf[3] === 0x2A)) return "tiff";
  return "unknown";
}

const EXT: Record<WebFormat, string> = { jpeg: ".jpg", png: ".png", webp: ".webp" };
const CONTENT_TYPE: Record<WebFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// ---------------------------------------------------------------------------
// Language resolution from Accept-Language header
// ---------------------------------------------------------------------------

const LANG_MAP: Record<string, string> = {
  // English
  "en": "English", "en-us": "English", "en-gb": "English", "en-gh": "English",
  // Ghanaian languages (primary target market)
  "ak": "Akan (Twi)", "tw": "Twi", "fat": "Fante", "ee": "Ewe",
  "ha": "Hausa", "dag": "Dagbani",
  // Other African languages
  "sw": "Swahili", "yo": "Yoruba", "ig": "Igbo",
  // European
  "fr": "French", "fr-fr": "French", "fr-ca": "French",
  "es": "Spanish", "es-es": "Spanish", "es-mx": "Spanish",
  "de": "German", "pt": "Portuguese", "pt-br": "Portuguese (Brazilian)",
  "it": "Italian", "nl": "Dutch", "pl": "Polish",
  // Middle East / Asia
  "ar": "Arabic", "ar-sa": "Arabic",
  "zh": "Chinese (Simplified)", "zh-cn": "Chinese (Simplified)", "zh-tw": "Chinese (Traditional)",
  "ja": "Japanese", "ko": "Korean", "hi": "Hindi", "tr": "Turkish",
};

function resolveLanguage(acceptLanguage: string | null): string {
  const tag = (acceptLanguage ?? "en").split(",")[0].split(";")[0].trim().toLowerCase();
  return LANG_MAP[tag] ?? LANG_MAP[tag.split("-")[0]] ?? "English";
}

// ---------------------------------------------------------------------------
// Manual algorithmic quality checks (always run, no API key required)
// Uses sharp pixel statistics — fails open on any sharp error.
// ---------------------------------------------------------------------------

type ValidationResult =
  | { approved: true }
  | { approved: false; issues: string[] };

async function performManualChecks(imageBytes: Uint8Array): Promise<ValidationResult> {
  const issues: string[] = [];
  try {
    const buf = Buffer.from(imageBytes);
    const [meta, stats] = await Promise.all([
      sharp(buf).metadata(),
      sharp(buf).stats(),
    ]);

    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    // 1. Minimum resolution — anything smaller than 300×300 will look poor at listing size
    if (width < 300 || height < 300) {
      issues.push(
        `Image resolution is too low (${width}×${height} px). ` +
        `Please upload a photo of at least 300×300 px for a clear product display.`
      );
    }

    // 2. Extreme aspect ratio — catches banner crops and very tall/narrow slices
    if (width > 0 && height > 0) {
      const ratio = width / height;
      if (ratio > 4 || ratio < 0.25) {
        issues.push(
          "Image proportions are too extreme. " +
          "Use a square or near-square photo (up to 4:1 or 1:4) for best results."
        );
      }
    }

    // Evaluate only RGB channels (first 3); ignore alpha to avoid false-dark readings
    // on transparent PNGs.
    const colorChannels = stats.channels.slice(0, Math.min(3, stats.channels.length));
    const meanBrightness = colorChannels.reduce((s, c) => s + c.mean, 0) / colorChannels.length;
    const maxStdev = Math.max(...colorChannels.map((c) => c.stdev));

    // 3. Near-blank / solid-colour — stdev < 8 across all channels means virtually
    //    no variation; the image is a blank fill or placeholder.
    if (maxStdev < 8) {
      issues.push(
        "Image appears to be blank or a solid colour. " +
        "Please upload an actual photo of your product."
      );
    }

    // 4. Too dark — mean brightness below 20 out of 255
    if (meanBrightness < 20) {
      issues.push(
        "Image is too dark — the product is not clearly visible. " +
        "Please retake the photo in better lighting."
      );
    }

    // 5. Overexposed — mean above 250 and very low variation means a near-white blank
    if (meanBrightness > 250 && maxStdev < 15) {
      issues.push(
        "Image is overexposed or blank white. " +
        "Please adjust the lighting so the product is clearly visible."
      );
    }
  } catch (err) {
    // Fail open — don't block uploads if sharp encounters an unexpected format
    console.warn("[product-images] manual checks skipped:", err instanceof Error ? err.message : err);
  }

  return issues.length > 0 ? { approved: false, issues } : { approved: true };
}

// ---------------------------------------------------------------------------
// AI image quality validation
// Fails open: if ANTHROPIC_API_KEY is unset or the API errors, the upload
// proceeds normally so sellers are never blocked by an infrastructure issue.
// ---------------------------------------------------------------------------

async function validateImage(
  imageBytes: Uint8Array,
  format: WebFormat,
  productName: string | null,
  language: string,
): Promise<ValidationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { approved: true };

  try {
    const client = new Anthropic({ apiKey });
    const base64 = Buffer.from(imageBytes).toString("base64");
    const mediaType = `image/${format}` as "image/jpeg" | "image/png" | "image/webp";

    const nameCtx = productName ? `Product being listed: "${productName}"\n` : "";
    const relevanceRule = productName
      ? `6. RELEVANCE — Does what is shown plausibly match the product name "${productName}"?\n`
      : "";

    const prompt =
      `You are a strict product image quality validator for an e-commerce marketplace.\n` +
      nameCtx +
      `\nInspect this image and evaluate ALL of the following criteria:\n\n` +
      `1. VISIBILITY — Is there a real, identifiable product clearly visible?\n` +
      `2. FRAMING — Is the product fully in frame and not cut off at the edges?\n` +
      `3. CLARITY — Is the image sharp, in focus, and adequately lit (not too dark or blown out)?\n` +
      `4. SCALE — Does the product occupy a reasonable portion of the frame? ` +
        `(Reject if it is a tiny speck in a sea of background, or so zoomed in the product is unrecognisable.)\n` +
      `5. CONTENT — Is this a genuine product photo? ` +
        `Reject screenshots, blank/solid-colour images, documents, memes, or unrelated content.\n` +
      `6. BACKGROUND — Is the background clean, neutral, and free of clutter? ` +
        `Reject images with messy rooms, dirty floors, piles of unrelated objects, laundry, food waste, ` +
        `or any distracting environment that undermines the professionalism of the listing.\n` +
      `7. APPROPRIATENESS — Is the image free of nudity, sexually suggestive content, ` +
        `graphic violence, hate symbols, or any other material that violates marketplace standards? ` +
        `Reject immediately if any such content is present, even partially visible in the background.\n` +
      relevanceRule +
      `\nRespond with ONLY a raw JSON object — no markdown fences, no commentary:\n` +
      `{"approved":true,"issues":[]}\n` +
      `or\n` +
      `{"approved":false,"issues":["Specific actionable reason 1","Specific actionable reason 2"]}\n` +
      `\nWrite every rejection reason in ${language}. ` +
      `Be specific and actionable so the vendor knows exactly what to fix.`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: prompt },
        ],
      }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    // Strip optional markdown fences the model occasionally emits despite instructions
    const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const result = JSON.parse(json) as { approved: boolean; issues?: string[] };

    if (result.approved === false && Array.isArray(result.issues) && result.issues.length > 0) {
      return { approved: false, issues: result.issues };
    }
    return { approved: true };
  } catch (err) {
    // Fail open — don't block uploads due to AI infrastructure issues
    console.warn("[product-images] AI validation skipped:", err instanceof Error ? err.message : err);
    return { approved: true };
  }
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

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

  // Optional: product name hint for relevance checking
  const productName = (formData.get("productName") as string | null)?.trim() || null;
  const language = resolveLanguage(request.headers.get("accept-language"));

  const rawBytes = await file.arrayBuffer();
  const sniffed = sniffFormat(new Uint8Array(rawBytes));

  let finalFormat: WebFormat;
  let finalBytes: Uint8Array;

  if (sniffed === "jpeg" || sniffed === "png" || sniffed === "webp") {
    finalFormat = sniffed;
    finalBytes = new Uint8Array(rawBytes);
  } else if (sniffed === "heic" || sniffed === "tiff") {
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
    return Response.json(
      { error: "Only JPEG, PNG, WebP, and HEIC images are accepted" },
      { status: 400 }
    );
  }

  // Manual quality gate — fast pixel-level checks, no API key needed.
  // Runs first so obvious rejections never incur an AI API call.
  const manualCheck = await performManualChecks(finalBytes);
  if (!manualCheck.approved) {
    return Response.json(
      { error: "Image did not pass quality check", issues: manualCheck.issues },
      { status: 422 }
    );
  }

  // AI quality gate — runs after format normalisation so we always send a
  // web-safe image to the model regardless of what the vendor originally uploaded.
  const validation = await validateImage(finalBytes, finalFormat, productName, language);
  if (!validation.approved) {
    return Response.json(
      { error: "Image did not pass quality check", issues: validation.issues },
      { status: 422 }
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
