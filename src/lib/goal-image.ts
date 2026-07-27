// Builds optimized Cloudinary delivery URLs from stored secure_urls. We store
// the plain upload URL and inject delivery transforms here at render time, so
// one stored asset can be delivered at whatever size/crop each surface needs:
//   f_auto  — best format per browser (AVIF/WebP/JPEG)
//   q_auto  — perceptual quality/size auto-tuning
//   c_fill  — fill the box, cropping overflow (g_auto picks the best subject)
//   c_limit — bound the box, KEEP aspect ratio (never upscales) — for photos
//   w_/h_   — target box, requested at ~2× for crisp retina delivery
//
// A non-Cloudinary URL (or a missing one) is passed through / nulled.

import type { Goal } from "./goals-api";

const TRANSFORM_ANCHOR = "/image/upload/";

export function optimizedCloudinaryUrl(
  url: string | null | undefined,
  { width, height, crop = "fill" }: { width?: number; height?: number; crop?: "fill" | "limit" } = {},
): string | null {
  if (!url) return null;

  const anchor = url.indexOf(TRANSFORM_ANCHOR);
  if (anchor === -1) return url; // not a Cloudinary upload URL — use as-is

  const parts = [`c_${crop}`, "f_auto", "q_auto"];
  if (crop === "fill") parts.push("g_auto");
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);

  const head = url.slice(0, anchor + TRANSFORM_ANCHOR.length);
  const tail = url.slice(anchor + TRANSFORM_ANCHOR.length);
  return `${head}${parts.join(",")}/${tail}`;
}

/** A goal's cover, cropped to fill the given box. */
export function goalImageUrl(
  goal: Pick<Goal, "imageUrl">,
  { width = 1000, height = 560 }: { width?: number; height?: number } = {},
): string | null {
  return optimizedCloudinaryUrl(goal.imageUrl, { width, height, crop: "fill" });
}

/** A note photo, bounded in width but keeping its natural aspect ratio. */
export function noteImageUrl(url: string, width = 1000): string {
  return optimizedCloudinaryUrl(url, { width, crop: "limit" }) ?? url;
}
