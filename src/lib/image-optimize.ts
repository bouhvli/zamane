// Client-side image optimization, run before upload so we never ship a 5 MB
// phone photo over the wire: downscale the longest side to `maxDim`, re-encode
// to WebP (JPEG fallback) at `quality`, and hand back a base64 data URL the
// upload endpoint can forward straight to Cloudinary. A typical 4 MB photo
// comes out around 150–300 KB. Cloudinary then layers delivery-time
// transforms (f_auto/q_auto/resize) on top — see goalImageUrl().

export type OptimizedImage = {
  /** `data:image/webp;base64,...` (or jpeg) — ready to POST as JSON. */
  dataUrl: string;
  width: number;
  height: number;
};

/** Hard cap on the *source* file we'll even attempt to decode, so a huge or
 *  malformed file fails fast with a friendly message instead of OOM-ing. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024; // 25 MB

type DrawableSource = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

// Prefer createImageBitmap with EXIF orientation applied, so portrait photos
// from phones aren't drawn sideways. Fall back to an <img> (modern browsers
// auto-orient by default) when the bitmap path is unavailable.
async function loadDrawable(file: File): Promise<DrawableSource> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // fall through to the <img> path
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function optimizeImage(
  file: File,
  { maxDim = 1600, quality = 0.82 }: { maxDim?: number; quality?: number } = {},
): Promise<OptimizedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("That image is too large (max 25 MB)");
  }

  const { source, width: w0, height: h0, release } = await loadDrawable(file);
  try {
    if (!w0 || !h0) throw new Error("Could not read that image");

    const scale = Math.min(1, maxDim / Math.max(w0, h0));
    const width = Math.max(1, Math.round(w0 * scale));
    const height = Math.max(1, Math.round(h0 * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser can't process images");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, width, height);

    // Prefer WebP; if the browser doesn't encode it, toDataURL returns a PNG —
    // detect that and fall back to JPEG, which every canvas supports.
    let dataUrl = canvas.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    return { dataUrl, width, height };
  } finally {
    release();
  }
}
