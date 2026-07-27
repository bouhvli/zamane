import type { VercelRequest, VercelResponse } from "@vercel/node";

import { methodGuard } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";
import { cloudinaryConfigured, uploadImage } from "../_lib/cloudinary";

// Accepts an already-optimized image as a base64 data URI in JSON
// (`{ dataUrl }`) and uploads it to Cloudinary via a signed request. The
// client downscales/re-encodes before sending (see src/lib/image-optimize.ts),
// so payloads are small; this ceiling is a safety valve against an
// unoptimized or hostile body, well under Vercel's request-body limit.
const MAX_DATA_URL_LENGTH = 8 * 1024 * 1024; // ~6 MB of decoded image

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!user.groupId) {
    res.status(403).json({ error: "Join or create a group before adding goals" });
    return;
  }

  if (!cloudinaryConfigured()) {
    res.status(503).json({ error: "Image uploads aren't configured yet." });
    return;
  }

  const body = req.body as { dataUrl?: unknown } | undefined;
  const dataUrl = typeof body?.dataUrl === "string" ? body.dataUrl : "";

  if (!dataUrl.startsWith("data:image/")) {
    res.status(400).json({ error: "Expected an image" });
    return;
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    res.status(413).json({ error: "Image is too large" });
    return;
  }

  try {
    const result = await uploadImage(dataUrl, "zamane/goals");
    res.status(201).json(result);
  } catch (error) {
    console.error("Cloudinary upload failed", error);
    res.status(502).json({ error: "Couldn't upload the image. Please try again." });
  }
}
