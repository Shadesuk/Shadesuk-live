const LOCAL_SITE_URL = "http://localhost:3000";

function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) {
    return LOCAL_SITE_URL;
  }

  try {
    return new URL(configured).origin;
  } catch {
    return LOCAL_SITE_URL;
  }
}

export const site = {
  name: "SHADESUK",
  description:
    "Modern eyewear. Premium restraint, product clarity, frictionless discovery.",
  get url() {
    return resolveSiteUrl();
  },
} as const;
