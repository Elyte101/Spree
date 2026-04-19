import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getBackendApiBaseUrl, getNextAuthSecret } from "@/lib/runtimeConfig";
import { UserRole } from "@/types/types";

const authSecret = getNextAuthSecret();

interface BackendAuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/sign-in",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        try {
          const response = await fetch(`${getBackendApiBaseUrl()}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
            cache: "no-store",
          });

          if (!response.ok) {
            return null;
          }

          const user = (await response.json()) as BackendAuthUser;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
        token.email = user.email;
      }

      if (trigger === "update" && session) {
        if (session.id) {
          token.id = session.id;
        }

        if (session.role) {
          token.role = session.role;
        }

        if (session.name) {
          token.name = session.name;
        }

        if (session.email) {
          token.email = session.email;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.name = (token.name as string | undefined) ?? session.user.name;
        session.user.email = (token.email as string | undefined) ?? session.user.email;
      }

      return session;
    },
  },
};
