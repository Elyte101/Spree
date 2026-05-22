import { proxyBackend } from "@/lib/serverApi";

export async function POST(request: Request) {
  const signature = request.headers.get("x-paystack-signature") ?? "";
  const body = await request.text();
  return proxyBackend(
    "/webhooks/paystack",
    {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "x-paystack-signature": signature,
      },
    },
    { internal: true }
  );
}
