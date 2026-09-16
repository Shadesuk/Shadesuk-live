import "server-only";

import sharp from "sharp";

export const ADMIN_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const ADMIN_IMAGE_MIN_EDGE = 200;
export const ADMIN_IMAGE_MAX_EDGE = 8000;
export const ADMIN_IMAGE_OUTPUT_EDGE = 1600;

export type ProcessedProductImage = {
  bytes: Buffer;
  width: number;
  height: number;
  contentType: "image/webp";
};

export function sniffImageType(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export async function processAdminProductImage(
  file: File,
): Promise<{ ok: true; value: ProcessedProductImage } | { ok: false; message: string }> {
  if (file.size <= 0) {
    return { ok: false, message: "Choose an image to upload." };
  }
  if (file.size > ADMIN_IMAGE_MAX_BYTES) {
    return { ok: false, message: "Images must be 8 MB or smaller." };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!sniffImageType(buffer)) {
    return { ok: false, message: "Use a JPEG, PNG, or WebP image." };
  }
  try {
    const image = sharp(buffer, { failOn: "error", sequentialRead: true });
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      return { ok: false, message: "That file is not a valid image." };
    }
    if (width < ADMIN_IMAGE_MIN_EDGE || height < ADMIN_IMAGE_MIN_EDGE) {
      return { ok: false, message: "Images must be at least 200 × 200 pixels." };
    }
    if (width > ADMIN_IMAGE_MAX_EDGE || height > ADMIN_IMAGE_MAX_EDGE) {
      return { ok: false, message: "Images cannot be larger than 8000 pixels on a side." };
    }
    const processed = await image
      .rotate()
      .resize({
        width: ADMIN_IMAGE_OUTPUT_EDGE,
        height: ADMIN_IMAGE_OUTPUT_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    const outWidth = processed.info.width;
    const outHeight = processed.info.height;
    if (!outWidth || !outHeight) {
      return { ok: false, message: "The image could not be processed." };
    }
    return {
      ok: true,
      value: {
        bytes: processed.data,
        width: outWidth,
        height: outHeight,
        contentType: "image/webp",
      },
    };
  } catch {
    return { ok: false, message: "The image could not be processed." };
  }
}
