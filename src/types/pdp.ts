import type { Availability } from "@/types/catalogue";

export type ProductDataSource = "live" | "demo";

export type AddToBagInput = {
  slug: string;
  colourId: string;
  quantity: number;
};

export type AddToBagResult =
  | { status: "deferred" }
  | { status: "unavailable"; availability: Availability }
  | { status: "error" };
