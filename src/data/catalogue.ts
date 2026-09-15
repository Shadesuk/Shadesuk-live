/**
 * Demo catalogue fixtures for structural frontend work.
 * Not production inventory. Not real brands. No photography assets yet.
 * Server-only — never import from a Client Component.
 */
import "server-only";

import type { BrandSource, Catalogue, Product } from "@/types/catalogue";

export const DEMO_CATALOGUE_NOTICE =
  "Demo catalogue fixtures. Not live inventory, not real brands, and not product photography.";

const brands: BrandSource[] = [
  {
    id: "brand-line-a",
    slug: "demo-line-a",
    name: "Demo Line A",
    status: "active",
    isDemo: true,
  },
  {
    id: "brand-line-b",
    slug: "demo-line-b",
    name: "Demo Line B",
    status: "active",
    isDemo: true,
  },
  {
    id: "brand-line-c",
    slug: "demo-line-c",
    name: "Demo Line C",
    status: "active",
    isDemo: true,
  },
];

const colours = {
  black: {
    id: "colour-black",
    slug: "black",
    name: "Black",
    hex: "#111111",
    available: true,
  },
  brown: {
    id: "colour-brown",
    slug: "brown",
    name: "Brown",
    hex: "#5c4033",
    available: true,
  },
  clear: {
    id: "colour-clear",
    slug: "clear",
    name: "Clear",
    hex: "#e9e7e1",
    available: true,
  },
  tortoise: {
    id: "colour-tortoise",
    slug: "tortoise",
    name: "Tortoise",
    hex: "#6b4f3b",
    available: true,
  },
  green: {
    id: "colour-green",
    slug: "green",
    name: "Green",
    hex: "#2f4f3f",
    available: false,
  },
} as const;

const products: Product[] = [
  {
    id: "product-frame-01",
    slug: "frame-01",
    name: "Frame 01",
    brandId: "brand-line-a",
    gender: ["men"],
    shape: ["aviator"],
    style: [],
    colours: [colours.black, colours.brown, colours.clear, colours.tortoise],
    price: 49,
    currency: "GBP",
    availability: "in_stock",
    isNewArrival: true,
    isBestSeller: false,
    images: [],
    isDemo: true,
  },
  {
    id: "product-frame-02",
    slug: "frame-02",
    name: "Frame 02",
    brandId: "brand-line-a",
    gender: ["women"],
    shape: ["cat-eye"],
    style: [],
    colours: [colours.black, colours.tortoise],
    price: 55,
    currency: "GBP",
    availability: "in_stock",
    isNewArrival: false,
    isBestSeller: true,
    images: [],
    isDemo: true,
  },
  {
    id: "product-frame-03",
    slug: "frame-03",
    name: "Frame 03",
    brandId: "brand-line-b",
    gender: ["unisex"],
    shape: ["rectangle"],
    style: [],
    colours: [colours.black],
    price: 45,
    currency: "GBP",
    availability: "in_stock",
    isNewArrival: false,
    isBestSeller: false,
    images: [],
    isDemo: true,
  },
  {
    id: "product-frame-04",
    slug: "frame-04",
    name: "Frame 04",
    brandId: "brand-line-b",
    gender: ["men", "unisex"],
    shape: ["square"],
    style: [],
    colours: [colours.brown, colours.green],
    price: 59,
    currency: "GBP",
    availability: "out_of_stock",
    isNewArrival: false,
    isBestSeller: false,
    images: [],
    isDemo: true,
  },
  {
    id: "product-frame-05",
    slug: "frame-05",
    name: "Frame 05",
    brandId: "brand-line-a",
    gender: ["women"],
    shape: ["round"],
    style: [],
    colours: [
      colours.black,
      colours.brown,
      colours.clear,
      colours.tortoise,
    ],
    price: 65,
    currency: "GBP",
    availability: "sold_out",
    isNewArrival: false,
    isBestSeller: false,
    images: [],
    isDemo: true,
  },
  {
    id: "product-frame-06",
    slug: "frame-06",
    name: "Frame 06",
    brandId: "brand-line-c",
    gender: ["unisex"],
    shape: ["aviator"],
    style: [],
    colours: [colours.black, colours.brown],
    price: 49,
    currency: "GBP",
    availability: "in_stock",
    isNewArrival: true,
    isBestSeller: true,
    images: [],
    isDemo: true,
  },
];

export const demoCatalogue: Catalogue = { brands, products };
