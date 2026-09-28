/**
 * Mode-aware PayPal CSP host fragments for Next.js headers.
 * Used by `next.config.ts`. Keep narrow: sandbox XOR live (+ shared objects CDN).
 *
 * Documented SDK / Checkout hosts:
 * - sandbox script: www.sandbox.paypal.com
 * - live script: www.paypal.com
 * - objects CDN: www.paypalobjects.com / *.paypalobjects.com
 * Official JS SDK CSP guidance also lists *.paypal.com / *.paypalobjects.com / *.venmo.com
 * for script/frame/connect/img/style. Venmo omitted (US-only; not in SHADESUK scope).
 */

export type PayPalCspMode = "sandbox" | "live";

export function resolvePayPalCspMode(raw: string | undefined = process.env.PAYPAL_MODE): PayPalCspMode {
  return raw?.trim().toLowerCase() === "live" ? "live" : "sandbox";
}

export function paypalCspSources(mode: PayPalCspMode = resolvePayPalCspMode()): {
  script: string;
  style: string;
  img: string;
  connect: string;
  frame: string;
  child: string;
  formAction: string;
} {
  const objects = "https://www.paypalobjects.com https://*.paypalobjects.com";
  if (mode === "live") {
    const paypal = "https://www.paypal.com https://*.paypal.com https://api-m.paypal.com";
    return {
      script: `${paypal} ${objects}`,
      style: `${paypal} ${objects}`,
      img: `${paypal} ${objects}`,
      connect: `${paypal} ${objects}`,
      frame: `${paypal} ${objects}`,
      child: `${paypal} ${objects}`,
      formAction: "https://www.paypal.com https://*.paypal.com",
    };
  }
  const sandbox =
    "https://www.sandbox.paypal.com https://*.sandbox.paypal.com https://api-m.sandbox.paypal.com";
  return {
    script: `${sandbox} ${objects}`,
    style: `${sandbox} ${objects}`,
    img: `${sandbox} ${objects}`,
    connect: `${sandbox} ${objects}`,
    frame: `${sandbox} ${objects}`,
    child: `${sandbox} ${objects}`,
    formAction: "https://www.sandbox.paypal.com https://*.sandbox.paypal.com",
  };
}

/**
 * Full CSP value for storefront responses. Includes Next-friendly script/style
 * allowances (`unsafe-inline` / `unsafe-eval`) — tighten with nonces in a later hardening pass.
 */
export function buildStorefrontContentSecurityPolicy(options?: {
  mode?: PayPalCspMode;
  supabaseOrigin?: string;
}): string {
  const paypal = paypalCspSources(options?.mode ?? resolvePayPalCspMode());
  const supabase = options?.supabaseOrigin?.trim() ?? supabaseOriginFromEnv();
  const connectExtra = supabase ? ` ${supabase}` : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${paypal.script}`,
    `style-src 'self' 'unsafe-inline' ${paypal.style}`,
    `img-src 'self' data: blob: https: ${paypal.img}`,
    "font-src 'self' data:",
    `connect-src 'self'${connectExtra} ${paypal.connect}`,
    `frame-src 'self' ${paypal.frame}`,
    `child-src 'self' ${paypal.child}`,
    `form-action 'self' ${paypal.formAction}`,
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

function supabaseOriginFromEnv(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    return "";
  }
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}
