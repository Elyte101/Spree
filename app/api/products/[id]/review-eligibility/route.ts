import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session) {
    return Response.json({ eligible: false, alreadyReviewed: false });
  }

  return proxyBackend(
    `/products/${id}/review-eligibility`,
    {
      headers: {
        "X-Actor-User-Id": session.user.id,
        "X-Actor-Role": session.user.role,
      },
    },
    { internal: true }
  );
}
