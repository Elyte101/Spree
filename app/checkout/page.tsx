import type { Metadata } from "next";

import { auth } from "@/auth";
import { getUserProfile } from "@/lib/serverApi";
import { CheckoutPage } from "@/components/checkout/checkoutPage";

export const metadata: Metadata = {
  title: "Checkout | Spree",
  description: "Complete your checkout",
};

export default async function CheckoutRoute() {
  const session = await auth();
  const profile = session?.user
    ? await getUserProfile(session.user.id, {
        name: session.user.name ?? undefined,
        email: session.user.email ?? undefined,
        role: session.user.role,
      })
    : null;

  return <CheckoutPage initialProfile={profile} />;
}
