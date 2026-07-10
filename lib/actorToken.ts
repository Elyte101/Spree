import "server-only";
import { SignJWT } from "jose";

import { getActorTokenSecret } from "@/lib/runtimeConfig";

// A2: short-lived signed token binding an actor's id + role to the request
// that carries it, so the backend no longer has to trust plain
// X-Actor-User-Id/X-Actor-Role headers as the sole proof of identity.
// Minted here (server-only, after the caller has already derived id/role
// from a verified NextAuth session) and verified by the backend with the
// same shared secret (ACTOR_TOKEN_SECRET).
const TOKEN_TTL_SECONDS = 60;
const ISSUER = "spree-next-proxy";
const AUDIENCE = "spree-backend";

let cachedSecretKey: Uint8Array | null = null;

const getSecretKey = (): Uint8Array => {
  if (!cachedSecretKey) {
    cachedSecretKey = new TextEncoder().encode(getActorTokenSecret());
  }
  return cachedSecretKey;
};

export async function mintActorToken(actor: {
  id: string;
  role: string;
  // Unix seconds the underlying NextAuth session was first established
  // (session.user.sessionIssuedAt) — distinct from this token's own `iat`,
  // which is always "now" since the token is re-minted on every request.
  // Lets the backend reject a still-unexpired session that predates a
  // password reset instead of waiting for the session's own maxAge to
  // naturally expire. Optional so callers that mint outside a full NextAuth
  // session (none today) don't need it.
  sessionIssuedAt?: number;
}): Promise<string> {
  const claims: Record<string, unknown> = { role: actor.role };
  if (actor.sessionIssuedAt !== undefined) {
    claims.siat = actor.sessionIssuedAt;
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(actor.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}
