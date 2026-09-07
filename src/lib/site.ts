export const site = {
  name: "SHADESUK",
  description:
    "Modern eyewear. Premium restraint, product clarity, frictionless discovery.",
  get url() {
    const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    return value || "http://localhost:3000";
  },
} as const;
