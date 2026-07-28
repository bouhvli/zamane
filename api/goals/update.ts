import type { VercelRequest, VercelResponse } from "@vercel/node";
import { updateGoalRequestSchema } from "../../shared/validation.js";

import { sql } from "../_lib/db.js";
import { methodGuard, parseBody } from "../_lib/http.js";
import { getUserFromRequest } from "../_lib/auth.js";
import { destroyImage } from "../_lib/cloudinary.js";

// Edits a goal's mutable fields (title, description, target). The goal type is
// immutable, so the request's declared type is only used to validate the
// payload shape and is checked against the stored row. For financial goals a
// changed target re-derives is_completed (lowering the target below the saved
// total should mark it done, raising it should reopen it); the running total
// itself is never stored — it's summed from contributions at read time.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(updateGoalRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id, title, description, targetDate, imageUrl, imagePublicId } = parsed.data;
  const nextImageUrl = imageUrl ?? null;
  const nextImagePublicId = imagePublicId ?? null;

  const goalRows = await sql`
    select goal_type as "goalType", image_public_id as "imagePublicId"
    from goals where id = ${id} and group_id = ${user.groupId} limit 1
  `;
  const goal = goalRows[0] as { goalType: "financial" | "general"; imagePublicId: string | null } | undefined;
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  if (goal.goalType !== parsed.data.goalType) {
    res.status(400).json({ error: "Goal type mismatch" });
    return;
  }

  if (parsed.data.goalType === "financial") {
    const { targetAmount } = parsed.data;
    await sql`
      update goals set
        title = ${title},
        description = ${description ?? null},
        target_amount = ${targetAmount},
        target_date = ${targetDate ?? null},
        image_url = ${nextImageUrl},
        image_public_id = ${nextImagePublicId},
        is_completed = (select coalesce(sum(amount), 0) from goal_contributions where goal_id = ${id}) >= ${targetAmount},
        updated_at = now()
      where id = ${id} and group_id = ${user.groupId}
    `;
  } else {
    await sql`
      update goals set
        title = ${title},
        description = ${description ?? null},
        target_date = ${targetDate ?? null},
        image_url = ${nextImageUrl},
        image_public_id = ${nextImagePublicId},
        updated_at = now()
      where id = ${id} and group_id = ${user.groupId}
    `;
  }

  // The image was swapped out or cleared — free the orphaned Cloudinary asset.
  if (goal.imagePublicId && goal.imagePublicId !== nextImagePublicId) {
    await destroyImage(goal.imagePublicId);
  }

  res.status(200).json({ ok: true });
}
