import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfilePage } from "@/components/profile/profilePage";
import { auth } from "@/auth";
import { getUserProfile } from "@/lib/serverApi";

export const metadata: Metadata = {
  title: "Profile | Spree",
  description: "Manage your Spree profile, store, shipping, and payment details",
};

export default async function ProfileRoute() {
  const session = await auth();

  if (!session) {
    redirect("/auth/sign-in?callbackUrl=/profile");
  }

  const profile = await getUserProfile(session.user.id, {
    name: session.user.name ?? undefined,
    email: session.user.email ?? undefined,
    role: session.user.role,
  });

  return <ProfilePage initialProfile={profile} />;
}
