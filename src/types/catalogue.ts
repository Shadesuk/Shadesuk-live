/**
 * Catalogue shape for later phases. No mock product data lives here.
 * Fields follow the locked SHADESUK demo catalogue contract.
 */
export type ProductColour = {
  id: string;
  name: string;
  slug: string;
};

export type ProductImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  gender: Array<"men" | "women" | "unisex">;
  shape: string[];
  style: string[];
  colours: ProductColour[];
  price: number;
  currency: "GBP";
  availability: "in_stock" | "out_of_stock" | "sold_out";
  isNewArrival: boolean;
  isBestSeller: boolean;
  images: ProductImage[];
  compareAtPrice?: number;
  colourCount?: number;
  description?: string;
  details?: string;
};
