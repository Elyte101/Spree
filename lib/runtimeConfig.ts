const DEFAULT_BACKEND_API_URL = "http://127.0.0.1:8000/api/v1";
const DEFAULT_BACKEND_INTERNAL_API_KEY = "spree-internal-dev-key";
const DEFAULT_NEXTAUTH_SECRET = "spree-dev-secret-change-me";

const isVercelDeployment = process.env.VERCEL === "1";
const isProductionLikeDeployment =
  isVercelDeployment || process.env.APP_ENV === "production";

const normalizeUrl = (value: string) => value.replace(/\/$/, "");

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
  const directApiUrl = getEnvValue("BACKEND_API_URL");

  if (directApiUrl) {
    return normalizeUrl(directApiUrl);
  }

  const backendUrl = getEnvValue("BACKEND_URL");

  if (backendUrl) {
    const normalizedBackendUrl = normalizeUrl(backendUrl);
    return normalizedBackendUrl.endsWith("/api/v1")
      ? normalizedBackendUrl
      : `${normalizedBackendUrl}/api/v1`;
  }

  return normalizeUrl(requireEnvOrFallback("BACKEND_API_URL", DEFAULT_BACKEND_API_URL));
};

export const getBackendInternalApiKey = () =>
  requireEnvOrFallback("BACKEND_INTERNAL_API_KEY", DEFAULT_BACKEND_INTERNAL_API_KEY);

export const getBackendStaticBaseUrl = () =>
  getBackendApiBaseUrl().replace(/\/api\/v1$/, "");

export const getNextAuthSecret = () =>
  requireEnvOrFallback("NEXTAUTH_SECRET", DEFAULT_NEXTAUTH_SECRET);
