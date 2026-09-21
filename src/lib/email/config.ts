import "server-only";

import { site } from "@/lib/site";

/**
 * Server-only Resend configuration. Keys are never prefixed with
 * `NEXT_PUBLIC_` so Next.js cannot inline them into the browser bundle.
 *
 * Template ids/aliases are not in this repository. Supply the published
 * Resend dashboard values via env; do not invent them in code.
 */

export type ResendTemplateKind = "order_confirmation" | "shipment_confirmation";

export type ResendConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  templates: Record<ResendTemplateKind, string>;
};

export type ResendConfigResult =
  | { ok: true; config: ResendConfig }
  | { ok: false; issues: string[] };

function readEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function resolveResendConfig(): ResendConfigResult {
  const apiKey = readEnv(process.env.RESEND_API_KEY);
  const fromEmail = readEnv(process.env.RESEND_FROM_EMAIL);
  const fromName = readEnv(process.env.RESEND_FROM_NAME) || site.name;
  const orderConfirmationTemplateId = readEnv(
    process.env.RESEND_ORDER_CONFIRMATION_TEMPLATE_ID,
  );
  const shipmentConfirmationTemplateId = readEnv(
    process.env.RESEND_SHIPMENT_CONFIRMATION_TEMPLATE_ID,
  );

  const issues: string[] = [];
  if (!apiKey) {
    issues.push("RESEND_API_KEY is not set");
  }
  if (!fromEmail) {
    issues.push("RESEND_FROM_EMAIL is not set");
  } else if (!isFromEmail(fromEmail)) {
    issues.push("RESEND_FROM_EMAIL is not a valid email address");
  }
  if (!orderConfirmationTemplateId) {
    issues.push("RESEND_ORDER_CONFIRMATION_TEMPLATE_ID is not set");
  }
  if (!shipmentConfirmationTemplateId) {
    issues.push("RESEND_SHIPMENT_CONFIRMATION_TEMPLATE_ID is not set");
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    config: {
      apiKey,
      fromEmail,
      fromName,
      templates: {
        order_confirmation: orderConfirmationTemplateId,
        shipment_confirmation: shipmentConfirmationTemplateId,
      },
    },
  };
}

export function formatResendFromHeader(config: Pick<ResendConfig, "fromEmail" | "fromName">): string {
  const name = config.fromName.replace(/[<>\r\n]/g, "").trim() || site.name;
  return `${name} <${config.fromEmail}>`;
}

function isFromEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function resolveResendWebhookSecret(): string {
  return readEnv(process.env.RESEND_WEBHOOK_SECRET);
}
