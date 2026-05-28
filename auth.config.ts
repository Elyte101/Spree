import type { NextAuthConfig } from "next-auth";

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
          auth?.user?.role !== "admin"
        ) {
          return Response.redirect(new URL("/", nextUrl.origin));
        }
      }

      return true;
    },
  },
};
