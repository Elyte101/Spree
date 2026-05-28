import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsPage } from "@/components/settings/settingsPage";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "Settings | Spree",
  description: "Manage your storefront preferences",
};

export default async function SettingsRoute() {
  const session = await auth();

  if (!session) {
    redirect("/auth/sign-in?callbackUrl=/settings");
  }

  return <SettingsPage />;
}
