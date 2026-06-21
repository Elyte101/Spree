import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getUserProfile } from "@/lib/serverApi";
import { VendorApplicationWizard } from "@/components/profile/vendorApplicationWizard";

export const metadata: Metadata = {
  title: "Become a vendor | Spree",
  description: "Set up your Spree store and start selling today",
};

export default async function SellerApplyPage() {
  const session = await auth();

  if (!session) {
    redirect("/auth/sign-in?callbackUrl=/vendor/apply");
  }

  if (session.user.role === "admin") {
    redirect("/dashboard");
  }

  const profile = await getUserProfile(session.user.id, {
    name: session.user.name ?? undefined,
    email: session.user.email ?? undefined,
    role: session.user.role,
  });

  return <VendorApplicationWizard profile={profile} />;
}
