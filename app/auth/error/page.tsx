import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in failed | Spree",
  robots: { index: false },
};

export default function AuthErrorPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.5rem", fontWeight: 900 }}>
          Sign in failed
        </h2>
        <p style={{ color: "#666", margin: "0 0 1.5rem" }}>
          We couldn&apos;t sign you in. Please try again or contact support if
          the problem persists.
        </p>
        <Link
          href="/auth/sign-in"
          style={{
            display: "inline-block",
            padding: "0.75rem 1.5rem",
            background: "#655AFF",
            color: "#fff",
            borderRadius: 999,
            textDecoration: "none",
            fontWeight: 700,
            fontSize: "0.95rem",
          }}
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
