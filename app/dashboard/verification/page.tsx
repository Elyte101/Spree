import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { VerificationQueue } from "@/components/admin/VerificationQueue";

export const metadata: Metadata = {
  title: "seller Verification | Dashboard | Spree",
  description: "Review and verify pending seller applications",
};

export default async function VerificationPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in?callbackUrl=/dashboard/verification");
  }
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return <VerificationQueue />;
}
