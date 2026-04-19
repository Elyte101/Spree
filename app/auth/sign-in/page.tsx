import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/signInForm";
import { authOptions } from "@/lib/auth";
import { canCreateProductsRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Sign In | Spree",
  description: "Sign in to your Spree account",
};

const DEFAULT_CALLBACK_URL = "/profile";

function sanitizeCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return DEFAULT_CALLBACK_URL;
  }

  return callbackUrl;
}

interface SignInPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
    reason?: string;
  }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getServerSession(authOptions);
  const { callbackUrl, reason } = await searchParams;
  const nextUrl = sanitizeCallbackUrl(callbackUrl);
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
