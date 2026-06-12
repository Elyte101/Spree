import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { SellerOnboardingWizard } from "@/components/seller/SellerOnboardingWizard";

export const metadata: Metadata = {
  title: "Become a Seller | Spree",
  description: "Set up your Spree store and start selling today",
};

export default async function SellerRegisterPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in?callbackUrl=/seller/register&reason=seller");
  }

  if (session.user.role === "admin") {
    redirect("/dashboard");
  }

  return <SellerOnboardingWizard />;
}
