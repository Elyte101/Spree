import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifications/notificationsPage";
import { getNotifications } from "@/lib/serverApi";

export const metadata: Metadata = {
  title: "Notifications | Spree",
  description: "Review storefront notifications and activity",
};

export default async function NotificationsRoute() {
  const notifications = await getNotifications();

  return <NotificationsPage notifications={notifications} />;
}
