import type { Metadata } from "next";
import { CheckoutPage } from "@/components/checkout/checkoutPage";

export const metadata: Metadata = {
  title: "Checkout | Spree",
  description: "Complete your checkout",
};

export default function CheckoutRoute() {
  return <CheckoutPage />;
}
