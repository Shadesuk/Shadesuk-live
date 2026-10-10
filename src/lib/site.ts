const LOCAL_SITE_URL = "http://localhost:3000";
const PRODUCTION_SITE_URL = "https://www.shadesuk.com";

function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // An unusable configured URL falls through to the environment default.
    }
  }
  const runtimeEnv = process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  if (runtimeEnv === "production") {
    return PRODUCTION_SITE_URL;
  }
  return LOCAL_SITE_URL;
}

export const site = {
  name: "SHADESUK",
  description:
    "Modern eyewear. Premium restraint, product clarity, frictionless discovery.",
  get url() {
    return resolveSiteUrl();
  },
} as const;
