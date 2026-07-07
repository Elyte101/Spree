import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ChatPageClient } from "@/components/chat/ChatPageClient";

export const metadata = {
  title: "Support Chat — Spree",
};

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/chat");
  if (session.user.role === "admin") redirect("/dashboard/chat");
  return <ChatPageClient />;
}
