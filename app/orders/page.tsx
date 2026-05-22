import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";

import { authOptions } from "@/lib/auth";
import { getOrders } from "@/lib/serverApi";
import { OrderHistoryPage } from "@/components/orders/orderHistoryPage";

export const metadata: Metadata = {
  title: "My Orders | Spree",
  description: "View your order history",
};

export default async function OrdersRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/sign-in?callbackUrl=%2Forders");
  }

  const orders = await getOrders(session.user.id, session.user.role);
  return <OrderHistoryPage orders={orders} />;
}
