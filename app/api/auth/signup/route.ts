import { proxyBackend } from "@/lib/serverApi";

export async function POST(request: Request) {
  return proxyBackend("/auth/signup", {
    method: "POST",
    body: await request.text(),
    headers: {
      "Content-Type": "application/json",
    },
  });
}
