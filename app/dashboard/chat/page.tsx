import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminChatPage } from "@/components/admin/AdminChatPage";

export const metadata = {
  title: "Support Chat — Spree Dashboard",
};

export default async function DashboardChatPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    redirect("/dashboard");
  }
  return <AdminChatPage />;
}
