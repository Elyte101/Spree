import { getBackendApiBaseUrl } from "@/lib/runtimeConfig";

const getBackendHealthUrl = () => {
  const apiBaseUrl = getBackendApiBaseUrl();
  const backendBaseUrl = apiBaseUrl.endsWith("/api/v1")
    ? apiBaseUrl.slice(0, -"/api/v1".length)
    : apiBaseUrl;

  return `${backendBaseUrl}/healthz`;
};

export async function GET() {
  try {
    const response = await fetch(getBackendHealthUrl(), {
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          detail: `Backend health check failed with status ${response.status}`,
        },
        {
          status: 503,
        }
      );
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      {
        ok: false,
        detail: "The backend API is not running. Start it with npm run dev:backend or npm run dev:full.",
      },
      {
        status: 503,
      }
    );
  }
}
