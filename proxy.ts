import { withAuth } from "next-auth/middleware";

const authSecret = process.env.NEXTAUTH_SECRET ?? "spree-dev-secret-change-me";

export default withAuth({
  pages: {
    signIn: "/auth/sign-in",
  },
  secret: authSecret,
  callbacks: {
    authorized: ({ token, req }) => {
      if (!token) {
        return false;
      }

      if (req.nextUrl.pathname.startsWith("/dashboard/products/new")) {
        return token.role === "admin";
      }

      return true;
    },
  },
});

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
