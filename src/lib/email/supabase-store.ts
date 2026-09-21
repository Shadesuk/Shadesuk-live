import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { providerFailureMessage } from "./errors";
import { EMAIL_EVENT_COLUMNS, parseEmailEventRow } from "./schema";
import type { EmailEventInsert, EmailEventPendingPatch, EmailEventStore } from "./store";

export function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return Boolean(error?.code === "23505" || text.includes("duplicate key"));
}

export function createSupabaseEmailEventStore(): EmailEventStore {
  const admin = createSupabaseAdminClient();

  return {
    async insertPending(row: EmailEventInsert) {
      const { data, error } = await admin
        .from("email_events")
        .insert(row)
        .select(EMAIL_EVENT_COLUMNS)
        .maybeSingle();

      if (isUniqueViolation(error)) {
        return { status: "conflict" };
      }
      if (error) {
        return { status: "error", error: providerFailureMessage(error) };
      }
      const event = parseEmailEventRow(data);
      if (!event) {
        return { status: "error", error: "Email event insert returned an unreadable row." };
      }
      return { status: "inserted", event };
    },

    async findByIdempotencyKey(key: string) {
      const { data, error } = await admin
        .from("email_events")
        .select(EMAIL_EVENT_COLUMNS)
        .eq("idempotency_key", key)
        .maybeSingle();
      if (error) {
        return null;
      }
      return parseEmailEventRow(data);
    },

    async findById(id: string) {
      const { data, error } = await admin
        .from("email_events")
        .select(EMAIL_EVENT_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) {
        return null;
      }
      return parseEmailEventRow(data);
    },

    async updateIfPending(id: string, patch: EmailEventPendingPatch) {
      const { data, error } = await admin
        .from("email_events")
        .update(patch)
        .eq("id", id)
        .eq("status", "pending")
        .select(EMAIL_EVENT_COLUMNS)
        .maybeSingle();
      if (error || !data) {
        return null;
      }
      return parseEmailEventRow(data);
    },
  };
}
