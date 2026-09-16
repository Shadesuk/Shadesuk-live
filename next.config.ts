import type { NextConfig } from "next";

function supabaseImagePattern(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    return [];
  }
  try {
    const hostname = new URL(url).hostname;
    if (!hostname) {
      return [];
    }
    return [
      {
        protocol: "https",
        hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["sharp"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseImagePattern(),
  },
};

export default nextConfig;
