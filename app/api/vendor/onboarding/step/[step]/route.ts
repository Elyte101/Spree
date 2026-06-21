import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ step: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { step } = await params;
  const stepNum = parseInt(step, 10);
  if (stepNum < 1 || stepNum > 5) return Response.json({ error: "Invalid step" }, { status: 400 });
  const body = await request.text();
  return proxyBackend(`/auth/onboarding/step/${stepNum}`, {
    method: "PATCH",
    headers: { "X-Actor-User-Id": session.user.id },
    body,
  }, { internal: true });
}
