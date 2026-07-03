import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { NotificationsPage } from "@/components/notifications/notificationsPage";
import { getNotifications } from "@/lib/serverApi";

export const metadata: Metadata = {
  title: "Notifications | Spree",
  description: "Review storefront notifications and activity",
};

export default async function NotificationsRoute() {
  const session = await auth();
  if (!session) {
    redirect("/auth/sign-in?callbackUrl=%2Fnotifications");
  }

  const notifications = await getNotifications(session.user.id);

  return <NotificationsPage notifications={notifications} />;
}
