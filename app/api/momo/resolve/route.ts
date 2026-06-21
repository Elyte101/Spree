import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { validateMoMoNumber } from "@/lib/ghana";
import { createMomoProvider } from "@/lib/momo/providers";

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

  try {
    const provider = createMomoProvider();
    const result = await provider.resolve(number, network);
    return NextResponse.json({
      resolved: true,
      name: result.name,
      provider: provider.providerName,
    });
  } catch (err) {
    // Return 200 so the client treats this as a soft failure, not a network error.
    const reason = err instanceof Error ? err.message : "Name enquiry unavailable";
    console.error("[momo/resolve]", err);
    return NextResponse.json({ resolved: false, reason });
  }
}
