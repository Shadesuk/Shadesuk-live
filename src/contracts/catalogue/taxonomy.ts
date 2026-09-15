import { GENDERS, SHAPES, type Gender, type Shape } from "@/types/catalogue";

const SHAPE_ALIASES: Record<string, Shape> = {
  aviator: "aviator",
  rectangle: "rectangle",
  square: "square",
  round: "round",
  "cat-eye": "cat-eye",
  cateye: "cat-eye",
  "cat eye": "cat-eye",
};

/**
 * PR #10 stores gender/shape as unconstrained text (often a single value).
 * Storefront types are locked arrays of approved tokens.
 * Unknown tokens are omitted — never coerced into a nearby shape/gender.
 */
export function parseGenderTokens(value: string | null | undefined): Gender[] {
  const tokens = splitTaxonomy(value);
  const matched = new Set<Gender>();
  for (const token of tokens) {
    const gender = GENDERS.find((item) => item === token);
    if (gender) {
      matched.add(gender);
    }
  }
  return GENDERS.filter((gender) => matched.has(gender));
}

export function parseShapeTokens(value: string | null | undefined): Shape[] {
  const tokens = splitTaxonomy(value);
  const matched = new Set<Shape>();
  for (const token of tokens) {
    const shape = SHAPE_ALIASES[token];
    if (shape) {
      matched.add(shape);
    }
  }
  return SHAPES.filter((shape) => matched.has(shape));
}

function splitTaxonomy(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/[,/|]+/)
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean);
}

/** kebab-case slug used for derived brand/colour ids. Empty input → null (do not invent). */
export function slugifyToken(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : null;
}
