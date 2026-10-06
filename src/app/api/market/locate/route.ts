import { supportedCountry } from "@/contracts/countries";
import { clientAddressFromHeaders } from "@/lib/request-address";
import { geocodeAttemptAllowed } from "@/lib/market/geocode-limit";

export const dynamic = "force-dynamic";

const GEOAPIFY_REVERSE = "https://api.geoapify.com/v1/geocode/reverse";

export async function POST(request: Request): Promise<Response> {
  const ip = clientAddressFromHeaders(request.headers);
  if (!geocodeAttemptAllowed(ip)) {
    return Response.json({ country: null }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ country: null }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const latitude = record?.latitude;
  const longitude = record?.longitude;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return Response.json({ country: null }, { status: 400 });
  }
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return Response.json({ country: null });
  }
  const url = new URL(GEOAPIFY_REVERSE);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("limit", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", apiKey);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      return Response.json({ country: null });
    }
    const payload = (await response.json()) as { results?: { country_code?: string }[] };
    const code = payload.results?.[0]?.country_code?.trim().toUpperCase() ?? "";
    const country = supportedCountry(code);
    return Response.json({ country: country?.code ?? null });
  } catch {
    return Response.json({ country: null });
  }
}
