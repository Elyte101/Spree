import type { DefaultSession } from "next-auth";

type AppUserRole = "customer" | "seller" | "admin";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: AppUserRole;
      emailVerified: Date | null;
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
  }
}
