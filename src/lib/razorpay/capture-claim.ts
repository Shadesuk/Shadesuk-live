/**
 * Decides the next India capture step after the payment row has been claimed.
 * Only `claimed` plus a still-authorized Razorpay payment may call capture.
 * `rejected` is an old or foreign attempt and must not capture.
 * An already-captured Razorpay payment is recorded in our database only.
 */

export const INDIA_CAPTURE_UNRECORDED = "razorpay_captured_unrecorded";

export type IndiaCaptureClaimStatus = "claimed" | "in_progress" | "duplicate" | "rejected" | "error";

export type IndiaCaptureStep = "capture" | "mark" | "retry" | "duplicate" | "reject" | "error";

export function indiaCaptureStep(input: {
  claim: IndiaCaptureClaimStatus;
  remoteStatus: string;
}): IndiaCaptureStep {
  if (input.claim === "error") {
    return "error";
  }
  if (input.claim === "duplicate") {
    return "duplicate";
  }
  if (input.claim === "rejected") {
    return "reject";
  }
  if (input.remoteStatus === "captured") {
    return "mark";
  }
  if (input.claim === "claimed" && input.remoteStatus === "authorized") {
    return "capture";
  }
  if (input.claim === "in_progress") {
    return "retry";
  }
  return "reject";
}
