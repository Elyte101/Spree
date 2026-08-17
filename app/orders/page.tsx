import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { getOrders } from "@/lib/serverApi";
import { OrderHistoryPage } from "@/components/orders/orderHistoryPage";

export const metadata: Metadata = {
  title: "My Orders | Spree",
  description: "View your order history",
};

export default async function OrdersRoute() {
  const session = await auth();
  if (!session) {
    redirect("/auth/sign-in?callbackUrl=%2Forders");
  }

  // Always request this user's own orders, regardless of role — /orders is
  // "My Orders" and must never widen to the admin all-orders view even for
  // an admin session. That view belongs at /dashboard (vendor/admin only).
  const orders = await getOrders(session.user.id, "user");
  return <OrderHistoryPage orders={orders} />;
}
