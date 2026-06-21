import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignInForm } from "@/components/auth/signInForm";
import { canCreateProductsRole } from "@/lib/roles";
import { isSafeCallbackUrl } from "@/lib/safeUrl";

export const metadata: Metadata = {
  title: "Sign In | Spree",
  description: "Sign in to your Spree account",
};

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string; reason?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const { callbackUrl, reason } = await searchParams;

  const nextUrl = isSafeCallbackUrl(callbackUrl ?? "") ? (callbackUrl ?? "/profile") : "/profile";
  const requiresSeller =
    reason === "seller" || nextUrl.startsWith("/dashboard/products/new");

  if (session && (!requiresSeller || canCreateProductsRole(session.user.role))) {
    redirect(nextUrl);
  }

  return (
    <SignInForm
      callbackUrl={nextUrl}
      reason={requiresSeller ? "seller" : undefined}
      currentUserEmail={session?.user.email ?? undefined}
      currentUserRole={session?.user.role}
    />
  );
}
