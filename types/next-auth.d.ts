import { DefaultSession } from "next-auth";

type AppUserRole = "customer" | "seller" | "admin";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: AppUserRole;
    };
  }

  interface User {
    id: string;
    role: AppUserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: AppUserRole;
  }
}
