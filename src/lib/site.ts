export const site = {
  name: "SHADESUK",
  description:
    "Modern eyewear. Premium restraint, product clarity, frictionless discovery.",
  get url() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
} as const;
