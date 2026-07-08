import { NextResponse } from "next/server";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  return proxyBackend("/auth/banks", { method: "GET" }, { internal: true });
}
