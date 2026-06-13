import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { getOrder } from "@/lib/serverApi";
import { OrderDetailPage } from "@/components/orders/orderDetailPage";

export const metadata: Metadata = {
  title: "Order Details | Spree",
};

export default async function OrderDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/auth/sign-in?callbackUrl=%2Forders");
  }

  const { id } = await params;
  const order = await getOrder(id, session.user.id, session.user.role);
  if (!order) notFound();

  return <OrderDetailPage order={order} sessionUserId={session.user.id} sessionUserRole={session.user.role} />;
}
