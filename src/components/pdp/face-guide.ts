import type { Shape } from "@/types/catalogue";
import { shapeLinks } from "@/lib/navigation";

export type FaceGuideEntry = {
  id: string;
  name: string;
  usually: string[];
  shapes: Shape[];
};

/**
 * Fashion guidance for the Size & Face Guide, not product facts.
 * Round matches the locked PDP example; other shapes stay general.
 */
export const FACE_GUIDE: FaceGuideEntry[] = [
  {
    id: "oval",
    name: "Oval",
    usually: ["Most silhouettes"],
    shapes: ["aviator", "rectangle", "square", "round", "cat-eye"],
  },
  {
    id: "round",
    name: "Round",
    usually: ["Rectangle", "Square", "Angular"],
    shapes: ["rectangle", "square"],
  },
  {
    id: "square",
    name: "Square",
    usually: ["Round", "Cat-Eye", "Aviator"],
    shapes: ["round", "cat-eye", "aviator"],
  },
  {
    id: "heart",
    name: "Heart",
    usually: ["Cat-Eye", "Round", "Aviator"],
    shapes: ["cat-eye", "round", "aviator"],
  },
  {
    id: "oblong",
    name: "Oblong",
    usually: ["Square", "Cat-Eye", "Round"],
    shapes: ["square", "cat-eye", "round"],
  },
  {
    id: "diamond",
    name: "Diamond",
    usually: ["Cat-Eye", "Round", "Aviator"],
    shapes: ["cat-eye", "round", "aviator"],
  },
];

export function shapeCollectionHref(shape: Shape): string {
  return shapeLinks.find((link) => link.href.endsWith(`/${shape}`))?.href ?? `/collections/${shape}`;
}

const SHAPE_LABELS: Record<Shape, string> = {
  aviator: "Aviator",
  rectangle: "Rectangle",
  square: "Square",
  round: "Round",
  "cat-eye": "Cat-Eye",
};

export function shapeLabel(shape: Shape): string {
  return SHAPE_LABELS[shape];
}
