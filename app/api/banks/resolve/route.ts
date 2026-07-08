import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { proxyBackend } from "@/lib/serverApi";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountNumber = searchParams.get("account_number")?.trim() ?? "";
  const bankCode = searchParams.get("bank_code")?.trim() ?? "";

  if (!accountNumber || !bankCode) {
    return NextResponse.json(
      { error: "account_number and bank_code are required" },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode });
  return proxyBackend(
    `/auth/banks/resolve?${params.toString()}`,
    { method: "GET" },
    { internal: true },
  );
}
