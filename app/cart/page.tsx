import type { Metadata } from "next";
import { CartPage } from "@/components/cart/cartPage";
import { getProducts } from "@/lib/serverApi";

export const metadata: Metadata = {
  title: "Cart | Spree",
  description: "Review the items in your cart",
};

export default async function CartRoute() {
  const recommendations = (await getProducts({ limit: 4, sort: "featured" })).items;

  return <CartPage recommendations={recommendations} />;
}
