import type { VercelRequest, VercelResponse } from "@vercel/node";
import { goalNoteIdSchema, type NoteBlock } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";
import { destroyImage } from "../_lib/cloudinary";

// Deletes a note from a goal's journal (group-scoped) and frees any images it
// held from Cloudinary (best-effort).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(goalNoteIdSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  const rows = await sql`
    delete from goal_notes where id = ${id} and group_id = ${user.groupId}
    returning blocks
  `;
  if (rows.length === 0) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const blocks = (rows[0].blocks ?? []) as NoteBlock[];
  for (const block of blocks) {
    if (block.type === "image" && block.publicId) await destroyImage(block.publicId);
  }

  res.status(200).json({ ok: true });
}
