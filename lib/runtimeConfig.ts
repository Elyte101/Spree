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
  requireEnvOrFallback("BACKEND_INTERNAL_API_KEY", DEFAULT_BACKEND_INTERNAL_API_KEY);

export const getBackendStaticBaseUrl = () =>
  getBackendApiBaseUrl().replace(/\/api\/v1$/, "");

export const getNextAuthSecret = () =>
  requireEnvOrFallback("NEXTAUTH_SECRET", DEFAULT_NEXTAUTH_SECRET);
