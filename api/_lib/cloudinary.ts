import { createHash } from "node:crypto";

// Minimal Cloudinary client — signed upload + destroy over fetch, no SDK.
// Credentials live only here, server-side, read from the environment:
//   CLOUDINARY_CLOUD_NAME  — your cloud's name (public; appears in delivery URLs)
//   CLOUDINARY_API_KEY     — the numeric API key
//   CLOUDINARY_API_SECRET  — the API secret (NEVER shipped to the client)
// Uploads are signed (SHA-1 of the sorted params + secret) so the secret never
// leaves the server and no unsigned upload preset is required.

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

/** True only when all three credentials are present — endpoints degrade
 *  gracefully (503) rather than 500 when uploads aren't configured yet. */
export function cloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && API_KEY && API_SECRET);
}

export type CloudinaryUploadResult = { url: string; publicId: string };

// Cloudinary signs the request from the alphabetically-sorted set of params
// being sent (excluding file, api_key, resource_type, cloud_name), joined as
// `k=v&k2=v2`, with the api secret appended, hashed with SHA-1.
function sign(params: Record<string, string>): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(toSign + API_SECRET).digest("hex");
}

/**
 * Upload an image (as a base64 `data:` URI) to Cloudinary and return its
 * canonical secure URL plus public id. Throws on misconfiguration or a
 * non-2xx response.
 */
export async function uploadImage(dataUrl: string, folder = "zamane/goals"): Promise<CloudinaryUploadResult> {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error("Cloudinary is not configured");
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign({ folder, timestamp });

  const form = new URLSearchParams();
  form.set("file", dataUrl);
  form.set("api_key", API_KEY);
  form.set("timestamp", timestamp);
  form.set("folder", folder);
  form.set("signature", signature);

  const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form,
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Cloudinary upload failed (${resp.status}): ${detail.slice(0, 300)}`);
  }

  const json = (await resp.json()) as { secure_url?: string; public_id?: string };
  if (!json.secure_url || !json.public_id) {
    throw new Error("Cloudinary returned an unexpected response");
  }
  return { url: json.secure_url, publicId: json.public_id };
}

/** Best-effort delete of an asset by public id — never throws (cleanup must
 *  not fail the surrounding request). No-op when Cloudinary isn't configured. */
export async function destroyImage(publicId: string): Promise<void> {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET || !publicId) return;
  try {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign({ public_id: publicId, timestamp });
    const form = new URLSearchParams();
    form.set("public_id", publicId);
    form.set("api_key", API_KEY);
    form.set("timestamp", timestamp);
    form.set("signature", signature);
    await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, { method: "POST", body: form });
  } catch {
    // swallow — a leaked asset is acceptable; a failed user action is not
  }
}
