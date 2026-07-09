import type { NextAuthConfig } from "next-auth";

import { canCreateProductsRole } from "./lib/roles";
import { getNextAuthSecret } from "./lib/runtimeConfig";

export const authConfig: NextAuthConfig = {
  // A1: fails closed — throws at import time in production/Vercel if
  // NEXTAUTH_SECRET/AUTH_SECRET is unset, instead of silently signing
  // JWTs with a publicly-known default secret.
  secret: getNextAuthSecret(),

  session: {
    strategy: "jwt",
    // A10: shorter-lived sessions so a blacklisted/soft-deleted user's stale
    // role can't be relied on for more than a day; rolling refresh on activity.
    maxAge: 24 * 60 * 60,
  },

  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/error",
  },

  providers: [],

  callbacks: {
    // Populate session.user.id and session.user.role from the JWT token so that
    // proxy.ts (the Next.js 16 middleware layer) can read req.auth.user.role.
    session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id as string;
        if (token.role) session.user.role = token.role as "customer" | "vendor" | "admin";
      }
      return session;
    },

    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      if (
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/settings")
      ) {
        if (!isLoggedIn) return false;

        if (
          pathname.startsWith("/dashboard/products/new") &&
          !canCreateProductsRole(auth?.user?.role)
        ) {
          return Response.redirect(new URL("/", nextUrl.origin));
        }
      }

      return true;
    },
  },
};
