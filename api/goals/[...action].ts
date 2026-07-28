import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  goalIdQuerySchema,
  createGoalRequestSchema,
  updateGoalRequestSchema,
  contributeRequestSchema,
  contributionIdSchema,
  createGoalNoteRequestSchema,
  goalNoteIdSchema,
  type NoteBlock,
} from "../../shared/validation.js";

import { sql } from "../_lib/db.js";
import { methodGuard, parseBody } from "../_lib/http.js";
import { getUserFromRequest } from "../_lib/auth.js";
import { cloudinaryConfigured, uploadImage, destroyImage } from "../_lib/cloudinary.js";

type ContributionRow = {
  id: string;
  amount: string | null;
  progressDelta: number | null;
  newProgressPct: number | null;
  note: string | null;
  createdAt: string;
};

const MAX_DATA_URL_LENGTH = 8 * 1024 * 1024; // ~6 MB of decoded image

// Consolidated into one function (goals/list, goals/create, etc. all routed
// here) to stay under the Hobby plan's 12 serverless function cap.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = Array.isArray(req.query.action) ? req.query.action.join("/") : "";

  switch (action) {
    case "list":
      return list(req, res);
    case "detail":
      return detail(req, res);
    case "create":
      return create(req, res);
    case "update":
      return update(req, res);
    case "delete":
      return remove(req, res);
    case "contribute":
      return contribute(req, res);
    case "contribution-delete":
      return contributionDelete(req, res);
    case "note-create":
      return noteCreate(req, res);
    case "note-delete":
      return noteDelete(req, res);
    case "upload-image":
      return uploadImageAction(req, res);
    default:
      res.status(404).json({ error: "Not found" });
  }
}

async function list(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["GET"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!user.groupId) {
    res.status(200).json({ goals: [], summary: { activeCount: 0, completedCount: 0, totalSavedThisMonth: 0 } });
    return;
  }

  // Goals are scoped to the caller's group — shared by the two members of
  // that group, invisible to everyone else.
  const goals = await sql`
    select
      g.id, g.title, g.description,
      g.goal_type as "goalType",
      g.target_amount as "targetAmount",
      coalesce(c.total, 0) as "currentAmount",
      g.current_progress_pct as "currentProgressPct",
      g.target_date as "targetDate",
      g.image_url as "imageUrl",
      g.is_completed as "isCompleted",
      g.created_by as "createdBy",
      u.display_name as "createdByName",
      u.email as "createdByEmail",
      g.created_at as "createdAt"
    from goals g
    left join users u on u.id = g.created_by
    left join (
      select goal_id, sum(amount) as total from goal_contributions group by goal_id
    ) c on c.goal_id = g.id
    where g.group_id = ${user.groupId}
    order by g.is_completed asc, g.created_at desc
  `;

  const [{ activeCount, completedCount }] = await sql`
    select
      count(*) filter (where not is_completed)::int as "activeCount",
      count(*) filter (where is_completed)::int as "completedCount"
    from goals
    where group_id = ${user.groupId}
  `;

  const [{ totalSavedThisMonth }] = await sql`
    select coalesce(sum(gc.amount), 0) as "totalSavedThisMonth"
    from goal_contributions gc
    join goals gl on gl.id = gc.goal_id
    where gl.group_id = ${user.groupId}
      and gc.amount is not null
      and gc.created_at >= date_trunc('month', now())
  `;

  res.status(200).json({
    goals,
    summary: { activeCount, completedCount, totalSavedThisMonth },
  });
}

async function detail(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["GET"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(goalIdQuerySchema, req.query);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  const rows = await sql`
    select
      g.id, g.title, g.description,
      g.goal_type as "goalType",
      g.target_amount as "targetAmount",
      coalesce(c.total, 0) as "currentAmount",
      g.current_progress_pct as "currentProgressPct",
      g.target_date as "targetDate",
      g.image_url as "imageUrl",
      g.image_public_id as "imagePublicId",
      g.is_completed as "isCompleted",
      g.created_by as "createdBy",
      u.display_name as "createdByName",
      u.email as "createdByEmail",
      g.created_at as "createdAt"
    from goals g
    left join users u on u.id = g.created_by
    left join (
      select goal_id, sum(amount) as total from goal_contributions where goal_id = ${id} group by goal_id
    ) c on true
    where g.id = ${id} and g.group_id = ${user.groupId}
    limit 1
  `;

  const goal = rows[0];
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const contributions = await sql`
    select
      gc.id,
      gc.user_id as "userId",
      u.display_name as "displayName",
      u.email,
      gc.amount,
      gc.progress_delta as "progressDelta",
      gc.new_progress_pct as "newProgressPct",
      gc.note,
      gc.created_at as "createdAt"
    from goal_contributions gc
    join users u on u.id = gc.user_id
    where gc.goal_id = ${id}
    order by gc.created_at desc
  `;

  // The goal page's "continuous note" feed — newest first. blocks is jsonb and
  // comes back already parsed to a JS array by the Neon driver.
  const notes = await sql`
    select
      gn.id,
      gn.blocks,
      gn.created_by as "createdBy",
      u.display_name as "displayName",
      u.email,
      gn.created_at as "createdAt"
    from goal_notes gn
    join users u on u.id = gn.created_by
    where gn.goal_id = ${id}
    order by gn.created_at desc
  `;

  res.status(200).json({ goal, contributions, notes });
}

async function create(req: VercelRequest, res: VercelResponse) {
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

  const parsed = parseBody(createGoalRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { title, description, goalType, targetDate, imageUrl, imagePublicId } = parsed.data;
  const targetAmount = parsed.data.goalType === "financial" ? parsed.data.targetAmount : null;

  const rows = await sql`
    insert into goals (title, description, goal_type, target_amount, target_date, image_url, image_public_id, created_by, group_id)
    values (${title}, ${description ?? null}, ${goalType}, ${targetAmount}, ${targetDate ?? null}, ${imageUrl ?? null}, ${imagePublicId ?? null}, ${user.id}, ${user.groupId})
    returning
      id, title, description,
      goal_type as "goalType",
      target_amount as "targetAmount",
      current_progress_pct as "currentProgressPct",
      target_date as "targetDate",
      image_url as "imageUrl",
      image_public_id as "imagePublicId",
      is_completed as "isCompleted",
      created_by as "createdBy",
      created_at as "createdAt"
  `;

  const goal = { ...rows[0], currentAmount: 0, createdByName: user.displayName, createdByEmail: user.email };

  res.status(201).json({ goal });
}

// Edits a goal's mutable fields (title, description, target). The goal type is
// immutable, so the request's declared type is only used to validate the
// payload shape and is checked against the stored row. For financial goals a
// changed target re-derives is_completed (lowering the target below the saved
// total should mark it done, raising it should reopen it); the running total
// itself is never stored — it's summed from contributions at read time.
async function update(req: VercelRequest, res: VercelResponse) {
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

// Deletes a goal and (via the ON DELETE CASCADE on goal_contributions) its
// whole contribution history. Group-scoped so a member can only delete their
// own couple's goals.
async function remove(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(goalIdQuerySchema, req.body);
  if (parsed.success === false) {
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

async function contribute(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(contributeRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { goalId } = parsed.data;

  const goalRows = await sql`
    select goal_type as "goalType", current_progress_pct as "currentProgressPct"
    from goals where id = ${goalId} and group_id = ${user.groupId} limit 1
  `;
  const goal = goalRows[0] as { goalType: "financial" | "general"; currentProgressPct: number } | undefined;
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  // Never trust the client's claimed type over the row — a mismatch means
  // stale UI state or a tampered request, not a legitimate contribution.
  if (goal.goalType !== parsed.data.goalType) {
    res.status(400).json({ error: "Goal type mismatch" });
    return;
  }

  let contributionRows: ContributionRow[];

  if (parsed.data.goalType === "financial") {
    const { amount, note } = parsed.data;
    [contributionRows] = (await sql.transaction([
      sql`
        insert into goal_contributions (goal_id, user_id, amount, note)
        values (${goalId}, ${user.id}, ${amount}, ${note ?? null})
        returning id, amount, progress_delta as "progressDelta", new_progress_pct as "newProgressPct", note, created_at as "createdAt"
      `,
      sql`
        update goals set
          is_completed = (select coalesce(sum(amount), 0) from goal_contributions where goal_id = ${goalId}) >= target_amount,
          updated_at = now()
        where id = ${goalId}
      `,
    ])) as [ContributionRow[], unknown];
  } else {
    const { newProgressPct, note } = parsed.data;
    const progressDelta = newProgressPct - goal.currentProgressPct;
    [contributionRows] = (await sql.transaction([
      sql`
        insert into goal_contributions (goal_id, user_id, progress_delta, new_progress_pct, note)
        values (${goalId}, ${user.id}, ${progressDelta}, ${newProgressPct}, ${note ?? null})
        returning id, amount, progress_delta as "progressDelta", new_progress_pct as "newProgressPct", note, created_at as "createdAt"
      `,
      sql`
        update goals set
          current_progress_pct = ${newProgressPct},
          is_completed = (${newProgressPct} >= 100),
          updated_at = now()
        where id = ${goalId}
      `,
    ])) as [ContributionRow[], unknown];
  }

  const contribution = { ...contributionRows[0], userId: user.id, displayName: user.displayName, email: user.email };

  const refreshedRows = await sql`
    select
      g.id, g.title, g.description,
      g.goal_type as "goalType",
      g.target_amount as "targetAmount",
      coalesce(c.total, 0) as "currentAmount",
      g.current_progress_pct as "currentProgressPct",
      g.target_date as "targetDate",
      g.is_completed as "isCompleted",
      g.created_at as "createdAt"
    from goals g
    left join (
      select goal_id, sum(amount) as total from goal_contributions where goal_id = ${goalId} group by goal_id
    ) c on true
    where g.id = ${goalId}
  `;

  res.status(200).json({ goal: refreshedRows[0], contribution });
}

// Removes a single contribution and re-derives the goal's completion state so
// a mistyped amount or wrong entry is correctable — contributions were
// previously append-only, which made a fat-fingered figure permanent shared
// financial data. Financial goals never store a running total (it's summed
// from goal_contributions at read time), so deleting a row is enough there;
// only is_completed needs recomputing. General goals store the latest
// percentage on the goal row, so after deletion it's reset to the most recent
// remaining contribution's value (or 0 when none remain).
async function contributionDelete(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(contributionIdSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  // Join back through goals to confirm the contribution belongs to the
  // caller's group before touching anything — the contribution row has no
  // group_id of its own.
  const rows = await sql`
    select gc.id, g.id as "goalId", g.goal_type as "goalType"
    from goal_contributions gc
    join goals g on g.id = gc.goal_id
    where gc.id = ${id} and g.group_id = ${user.groupId}
    limit 1
  `;
  const found = rows[0] as { goalId: string; goalType: "financial" | "general" } | undefined;
  if (!found) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }
  const { goalId } = found;

  if (found.goalType === "financial") {
    await sql.transaction([
      sql`delete from goal_contributions where id = ${id}`,
      sql`
        update goals set
          is_completed = (select coalesce(sum(amount), 0) from goal_contributions where goal_id = ${goalId}) >= target_amount,
          updated_at = now()
        where id = ${goalId}
      `,
    ]);
  } else {
    // The subquery runs after the delete within the same transaction, so it
    // reflects the remaining rows.
    await sql.transaction([
      sql`delete from goal_contributions where id = ${id}`,
      sql`
        update goals set
          current_progress_pct = coalesce(
            (select new_progress_pct from goal_contributions where goal_id = ${goalId} order by created_at desc limit 1),
            0
          ),
          is_completed = coalesce(
            (select new_progress_pct from goal_contributions where goal_id = ${goalId} order by created_at desc limit 1),
            0
          ) >= 100,
          updated_at = now()
        where id = ${goalId}
      `,
    ]);
  }

  res.status(200).json({ ok: true });
}

// Appends a note to a goal's shared journal. The note body is an ordered list
// of text/image blocks (validated in shared/validation) stored as jsonb, so a
// photo can sit at any position. Group-scoped: the goal must belong to the
// caller's group.
async function noteCreate(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!user.groupId) {
    res.status(403).json({ error: "Join or create a group first" });
    return;
  }

  const parsed = parseBody(createGoalNoteRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { goalId, blocks } = parsed.data;

  // Trim text blocks and drop the empty ones the composer may leave behind.
  const cleaned = blocks
    .map((block) => (block.type === "text" ? { ...block, value: block.value.trim() } : block))
    .filter((block) => block.type === "image" || block.value.length > 0);
  if (cleaned.length === 0) {
    res.status(400).json({ error: "Write something first" });
    return;
  }

  const goalRows = await sql`
    select id from goals where id = ${goalId} and group_id = ${user.groupId} limit 1
  `;
  if (goalRows.length === 0) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const rows = await sql`
    insert into goal_notes (goal_id, group_id, created_by, blocks)
    values (${goalId}, ${user.groupId}, ${user.id}, ${JSON.stringify(cleaned)}::jsonb)
    returning id, blocks, created_by as "createdBy", created_at as "createdAt"
  `;

  const note = { ...rows[0], displayName: user.displayName, email: user.email };
  res.status(201).json({ note });
}

// Deletes a note from a goal's journal (group-scoped) and frees any images it
// held from Cloudinary (best-effort).
async function noteDelete(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(goalNoteIdSchema, req.body);
  if (parsed.success === false) {
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

// Accepts an already-optimized image as a base64 data URI in JSON
// (`{ dataUrl }`) and uploads it to Cloudinary via a signed request. The
// client downscales/re-encodes before sending (see src/lib/image-optimize.ts),
// so payloads are small; this ceiling is a safety valve against an
// unoptimized or hostile body, well under Vercel's request-body limit.
async function uploadImageAction(req: VercelRequest, res: VercelResponse) {
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
