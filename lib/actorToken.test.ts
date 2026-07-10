import { describe, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";
import { mintActorToken } from "./actorToken";

vi.mock("@/lib/runtimeConfig", () => ({
  getActorTokenSecret: () => "test-actor-secret-at-least-20-chars",
}));

const SECRET = new TextEncoder().encode("test-actor-secret-at-least-20-chars");

describe("mintActorToken", () => {
  it("embeds sub/role and omits siat when sessionIssuedAt is not provided", async () => {
    const token = await mintActorToken({ id: "user-1", role: "admin" });
    const { payload } = await jwtVerify(token, SECRET, {
      issuer: "spree-next-proxy",
      audience: "spree-backend",
    });

    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("admin");
    expect(payload.siat).toBeUndefined();
  });

  it("embeds siat (A10 follow-up) when sessionIssuedAt is provided", async () => {
    const sessionIssuedAt = Math.floor(Date.now() / 1000) - 3600;
    const token = await mintActorToken({ id: "user-2", role: "vendor", sessionIssuedAt });
    const { payload } = await jwtVerify(token, SECRET, {
      issuer: "spree-next-proxy",
      audience: "spree-backend",
    });

    expect(payload.siat).toBe(sessionIssuedAt);
  });
});
