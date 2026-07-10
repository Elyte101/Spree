import type { DefaultSession } from "next-auth";

type AppUserRole = "customer" | "vendor" | "admin";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: AppUserRole;
      emailVerified: Date | null;
      // Unix seconds this specific session was established (set once at
      // sign-in, never refreshed) — lets the backend reject actor tokens
      // minted from a session that predates a subsequent password reset.
      // See lib/actorToken.ts / backend/app/api/deps.py.
      sessionIssuedAt?: number;
    };
  }

  interface User {
    role?: AppUserRole;
    emailVerified?: Date | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: AppUserRole;
    emailVerified?: boolean;
    sessionIssuedAt?: number;
  }
}
