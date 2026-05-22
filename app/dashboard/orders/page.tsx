import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";

import { authOptions } from "@/lib/auth";
import { canCreateProductsRole } from "@/lib/roles";
import { getSellerOrders } from "@/lib/serverApi";
import { SellerOrdersPage } from "@/components/admin/sellerOrdersPage";

export const metadata: Metadata = {
  title: "Orders | Seller Dashboard | Spree",
};

export default async function DashboardOrdersRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/sign-in?callbackUrl=%2Fdashboard%2Forders");
  }

  const canSell = canCreateProductsRole(session.user.role);
  if (!canSell) {
    redirect("/dashboard");
  }

  const orders = await getSellerOrders(session.user.id);
  return <SellerOrdersPage orders={orders} />;
}
