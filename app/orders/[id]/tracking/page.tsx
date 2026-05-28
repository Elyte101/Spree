import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { getOrder } from "@/lib/serverApi";
import { OrderTrackingPage } from "@/components/orders/orderTrackingPage";

export const metadata: Metadata = {
  title: "Track Order | Spree",
};

export default async function OrderTrackingRoute({
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

  return <OrderTrackingPage order={order} />;
}
