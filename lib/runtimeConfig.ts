const DEFAULT_BACKEND_API_URL = "http://127.0.0.1:8000/api/v1";
const DEFAULT_BACKEND_INTERNAL_API_KEY = "spree-internal-dev-key";
const DEFAULT_NEXTAUTH_SECRET = "spree-dev-secret-change-me";

const isVercelDeployment = process.env.VERCEL === "1";
const isProductionLikeDeployment =
  isVercelDeployment || process.env.APP_ENV === "production";

const normalizeUrl = (value: string) => value.replace(/\/$/, "");

const isLocalhostUrl = (url: string) =>
  /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url);

const getEnvValue = (name: string) => {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
};

const requireEnvOrFallback = (name: string, fallback: string) => {
  const value = getEnvValue(name);

  if (value) {
    return value;
  }

  if (isProductionLikeDeployment) {
    throw new Error(`${name} must be configured for deployed environments.`);
  }

  return fallback;
};

// A1: fail closed on weak secrets, not just missing ones. A deployed env that
// explicitly sets NEXTAUTH_SECRET/BACKEND_INTERNAL_API_KEY to the dev default
// (or to anything implausibly short) is just as forgeable as leaving it unset.
const MIN_SECRET_LENGTH = 20;

const requireStrongSecret = (name: string, fallback: string) => {
  const value = requireEnvOrFallback(name, fallback);

  if (isProductionLikeDeployment && (value === fallback || value.length < MIN_SECRET_LENGTH)) {
    throw new Error(
      `${name} must be set to a strong random value (>= ${MIN_SECRET_LENGTH} chars, not the dev default) ` +
        "in deployed environments."
    );
  }

  return value;
};

export const getBackendApiBaseUrl = () => {
  // Accept either var; BACKEND_API_URL takes priority.
  // Both are normalised the same way: ensure they end with /api/v1.
  const raw = getEnvValue("BACKEND_API_URL") ?? getEnvValue("BACKEND_URL");

  if (raw) {
    const url = normalizeUrl(raw);
    if (isProductionLikeDeployment && isLocalhostUrl(url)) {
      throw new Error(
        `Backend URL is set to a localhost address ("${url}") which is unreachable from Vercel. ` +
        `Set BACKEND_URL to your deployed backend origin (e.g. https://api.yourdomain.com).`
      );
    }
    return url.endsWith("/api/v1") ? url : `${url}/api/v1`;
  }

  return normalizeUrl(requireEnvOrFallback("BACKEND_API_URL", DEFAULT_BACKEND_API_URL));
};

export const getBackendInternalApiKey = () =>
  requireStrongSecret("BACKEND_INTERNAL_API_KEY", DEFAULT_BACKEND_INTERNAL_API_KEY);

export const getBackendStaticBaseUrl = () =>
  getBackendApiBaseUrl().replace(/\/api\/v1$/, "");

export const getNextAuthSecret = () =>
  requireStrongSecret("NEXTAUTH_SECRET", DEFAULT_NEXTAUTH_SECRET);

// A2: shared secret used to sign/verify short-lived actor tokens between the
// Next proxy and the FastAPI backend (see lib/actorToken.ts). Distinct from
// NEXTAUTH_SECRET so the two can be rotated independently.
const DEFAULT_ACTOR_TOKEN_SECRET = "spree-dev-actor-token-secret-change-me";

export const getActorTokenSecret = () =>
  requireStrongSecret("ACTOR_TOKEN_SECRET", DEFAULT_ACTOR_TOKEN_SECRET);
