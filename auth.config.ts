import type { NextAuthConfig } from "next-auth";

import { canCreateProductsRole } from "./lib/roles";

export const authConfig: NextAuthConfig = {
  secret:
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET ??
    "spree-dev-secret-change-me",

  session: { strategy: "jwt" },

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
        if (token.role) session.user.role = token.role as "customer" | "seller" | "admin";
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
