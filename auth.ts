import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { z } from "zod";

import { authConfig } from "./auth.config";
import { checkRateLimit, clearFailedAttempts, recordFailedAttempt } from "@/lib/rateLimit";
import { getBackendApiBaseUrl, getBackendInternalApiKey } from "@/lib/runtimeConfig";
import { isSafeCallbackUrl } from "@/lib/safeUrl";

type AppUserRole = "customer" | "seller" | "admin";

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function callBackend(path: string, body: object) {
  return fetch(`${getBackendApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Api-Key": getBackendInternalApiKey(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Google,
    Apple,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = SignInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const ipKey = "login-ip:server";
        if (!checkRateLimit(email).allowed) return null;

        try {
          const res = await callBackend("/auth/login", { email, password });
          if (!res.ok) {
            recordFailedAttempt(email);
            recordFailedAttempt(ipKey);
            return null;
          }
          const user = await res.json();
          clearFailedAttempts(email);
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as AppUserRole,
            emailVerified: user.email_verified ? new Date() : null,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async redirect({ url, baseUrl }) {
      return isSafeCallbackUrl(url) ? new URL(url, baseUrl).toString() : baseUrl;
    },

    async jwt({ token, user, account, trigger, session }) {
      if (user && account) {
        if (account.provider !== "credentials") {
          // OAuth: sync with FastAPI backend to get our internal user ID + role
          try {
            const res = await callBackend("/auth/oauth-upsert", {
              email: user.email,
              name: user.name,
              provider: account.provider,
              provider_account_id: account.providerAccountId,
            });
            if (res.ok) {
              const backendUser = await res.json();
              token.id = backendUser.id;
              token.role = backendUser.role as AppUserRole;
              token.emailVerified = true;
            } else {
              return null as unknown as typeof token; // deny sign-in if backend sync fails
            }
          } catch {
            return null as unknown as typeof token;
          }
        } else {
          token.id = user.id;
          token.role = (user as { role?: AppUserRole }).role;
          token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified != null;
        }
        token.name = user.name;
        token.email = user.email;
      }

      if (trigger === "update" && session) {
        return { ...token, ...session };
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as AppUserRole;
        session.user.name = (token.name as string | undefined) ?? session.user.name;
        session.user.email = (token.email as string | undefined) ?? session.user.email;
        session.user.emailVerified = token.emailVerified
          ? new Date()
          : null;
      }
      return session;
    },
  },

  events: {
    async signIn({ user }) {
      if (user?.email) clearFailedAttempts(user.email);
    },
  },
});
