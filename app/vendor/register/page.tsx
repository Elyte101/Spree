import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { VendorOnboardingWizard } from "@/components/vendor/SellerOnboardingWizard";

export const metadata: Metadata = {
  title: "Become a vendor | Spree",
  description: "Set up your Spree store and start selling today",
};

export default async function VendorRegisterPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in?callbackUrl=/vendor/register&reason=vendor");
  }

  if (session.user.role === "admin") {
    redirect("/dashboard");
  }

  return <VendorOnboardingWizard />;
}
