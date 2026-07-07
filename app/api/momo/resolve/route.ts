import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { validateMoMoNumber } from "@/lib/ghana";
import { proxyBackend } from "@/lib/serverApi";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const number = typeof (body as Record<string, unknown>).number === "string"
    ? ((body as Record<string, unknown>).number as string).trim()
    : "";
  const network = typeof (body as Record<string, unknown>).network === "string"
    ? ((body as Record<string, unknown>).network as string).trim().toLowerCase()
    : "";

  if (!number || !network) {
    return NextResponse.json({ error: "number and network are required" }, { status: 400 });
  }

  const momoErr = validateMoMoNumber(number);
  if (momoErr) {
    return NextResponse.json({ error: momoErr }, { status: 400 });
  }

  // Proxy to the backend, which holds PAYSTACK_SECRET_KEY.
  // The backend returns {"resolved": true, "name": "..."} on success,
  // or a non-200 status with {"detail": "..."} on failure.
  return proxyBackend(
    "/momo/resolve",
    {
      method: "POST",
      body: JSON.stringify({ number, network }),
      headers: { "Content-Type": "application/json" },
    },
    { internal: true },
  );
}
