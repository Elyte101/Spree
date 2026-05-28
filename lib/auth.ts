import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getBackendApiBaseUrl, getNextAuthSecret } from "@/lib/runtimeConfig";
import { checkRateLimit, clearFailedAttempts } from "@/lib/rateLimit";
import { isSafeCallbackUrl } from "@/lib/safeUrl";
import { UserRole } from "@/types/types";

const isProd = process.env.NODE_ENV === "production";
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
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  cookies: {
    sessionToken: {
      name: isProd
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProd },
    },
    callbackUrl: {
      name: isProd
        ? "__Secure-next-auth.callback-url"
        : "next-auth.callback-url",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProd },
    },
    csrfToken: {
      name: isProd
        ? "__Host-next-auth.csrf-token"
        : "next-auth.csrf-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProd },
    },
  },
  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/error",
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

        if (!checkRateLimit(email).allowed) {
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

          clearFailedAttempts(email);
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
  events: {
    async signIn({ user }) {
      // Clear the per-email pessimistic counter on successful login so the
      // account is not locked out after 5 cumulative attempts (including successes).
      if (user?.email) {
        clearFailedAttempts(user.email);
      }
    },
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      return isSafeCallbackUrl(url)
        ? new URL(url, baseUrl).toString()
        : baseUrl;
    },
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
