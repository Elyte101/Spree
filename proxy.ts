import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "./auth.config";

// Use the edge-safe config (no Node.js deps) so this runs without issues
// in the middleware / proxy runtime.
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  const { nextUrl } = req;

  // Strip ?error= from /auth/error before the RSC render reaches the page.
  // The static route handler at app/auth/error/route.ts returns byte-identical
  // HTML for every input, but stripping here also lets us log the code server-side.
  if (nextUrl.pathname === "/auth/error" && nextUrl.search) {
    console.error("[auth/error]", nextUrl.searchParams.get("error") ?? "unknown");
    const clean = nextUrl.clone();
    clean.search = "";
    return NextResponse.rewrite(clean);
  }

  const isLoggedIn = !!req.auth?.user;
  const isProtected =
    nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/settings");

  if (isProtected && !isLoggedIn) {
    const url = new URL("/auth/sign-in", req.url);
    url.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (
    nextUrl.pathname.startsWith("/dashboard/products/new") &&
    req.auth?.user?.role !== "admin"
  ) {
    return NextResponse.redirect(new URL("/", req.url));
  }
});

export const config = {
  matcher: ["/auth/error", "/dashboard/:path*", "/settings/:path*"],
};
