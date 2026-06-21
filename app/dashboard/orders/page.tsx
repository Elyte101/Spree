import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { canCreateProductsRole } from "@/lib/roles";
import { getSellerOrders } from "@/lib/serverApi";
import { VendorOrdersPage } from "@/components/admin/vendorOrdersPage";

export const metadata: Metadata = {
  title: "Orders | vendor Dashboard | Spree",
};

export default async function DashboardOrdersRoute() {
  const session = await auth();
  if (!session) {
    redirect("/auth/sign-in?callbackUrl=%2Fdashboard%2Forders");
  }

  const canSell = canCreateProductsRole(session.user.role);
  if (!canSell) {
    redirect("/dashboard");
  }

  const orders = await getSellerOrders(session.user.id);
  return <VendorOrdersPage orders={orders} />;
}
