import type { VercelRequest, VercelResponse } from "@vercel/node";
import { goalIdQuerySchema, type NoteBlock } from "../../shared/validation.js";

import { sql } from "../_lib/db.js";
import { methodGuard, parseBody } from "../_lib/http.js";
import { getUserFromRequest } from "../_lib/auth.js";
import { destroyImage } from "../_lib/cloudinary.js";

// Deletes a goal and (via the ON DELETE CASCADE on goal_contributions) its
// whole contribution history. Group-scoped so a member can only delete their
// own couple's goals.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(goalIdQuerySchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  // Gather note image ids BEFORE the delete (the goal_notes rows cascade away
  // with the goal, so we can't read them afterwards).
  const noteRows = await sql`
    select blocks from goal_notes where goal_id = ${id} and group_id = ${user.groupId}
  `;

  const rows = await sql`
    delete from goals where id = ${id} and group_id = ${user.groupId}
    returning image_public_id as "imagePublicId"
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  // Free the goal's cover + every image its notes held (best-effort; never
  // blocks the delete — the DB rows are already gone via ON DELETE CASCADE).
  const imagePublicId = (rows[0] as { imagePublicId: string | null }).imagePublicId;
  if (imagePublicId) await destroyImage(imagePublicId);
  for (const row of noteRows) {
    for (const block of (row.blocks ?? []) as NoteBlock[]) {
      if (block.type === "image" && block.publicId) await destroyImage(block.publicId);
    }
  }

  res.status(200).json({ ok: true });
}
