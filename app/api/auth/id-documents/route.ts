import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getBackendApiBaseUrl, getBackendInternalApiKey } from "@/lib/runtimeConfig";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }

  const formData = await request.formData();
  const backendUrl = `${getBackendApiBaseUrl()}/auth/profile/${session.user.id}/id-documents`;

  const response = await fetch(backendUrl, {
    method: "POST",
    headers: { "X-Internal-Api-Key": getBackendInternalApiKey() },
    body: formData,
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
