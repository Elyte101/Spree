import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SettingsPage } from "@/components/settings/settingsPage";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Settings | Spree",
  description: "Manage your storefront preferences",
};

export default async function SettingsRoute() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/sign-in?callbackUrl=/settings");
  }

  return <SettingsPage />;
}
