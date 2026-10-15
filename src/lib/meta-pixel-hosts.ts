/**
 * Meta Pixel script and CSP hosts only. The Pixel ID lives in
 * NEXT_PUBLIC_META_PIXEL_ID and must not be hardcoded here.
 */

export const META_PIXEL_SCRIPT_SRC = "https://connect.facebook.net/en_US/fbevents.js";
export const META_PIXEL_SCRIPT_ATTR = "data-shadesuk-meta-pixel";

export const META_PIXEL_CSP_SCRIPT = "https://connect.facebook.net";
export const META_PIXEL_CSP_CONNECT = "https://www.facebook.com https://connect.facebook.net";
export const META_PIXEL_CSP_FRAME = "https://www.facebook.com https://web.facebook.com";
