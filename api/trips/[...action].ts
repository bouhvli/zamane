import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  tripIdQuerySchema,
  createTripRequestSchema,
  updateTripRequestSchema,
  createItineraryItemRequestSchema,
  updateItineraryItemRequestSchema,
  setItineraryItemDoneRequestSchema,
  itineraryItemIdSchema,
  createTripPlaceRequestSchema,
  updateTripPlaceRequestSchema,
  setTripPlaceVisitedRequestSchema,
  tripPlaceIdSchema,
  createChecklistItemRequestSchema,
  setChecklistItemDoneRequestSchema,
  checklistItemIdSchema,
} from "../../shared/validation.js";

import { sql } from "../_lib/db.js";
import { tripsForGroup, EMPTY_TRIPS } from "../_lib/queries.js";
import { methodGuard, parseBody, getCatchAllAction } from "../_lib/http.js";
import { getUserFromRequest } from "../_lib/auth.js";

// Consolidated into one function (trips/list, trips/create, trips/itinerary/*,
// etc. all routed here) to stay under the Hobby plan's 12 serverless function cap.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = getCatchAllAction(req);

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
    case "itinerary/create":
      return itineraryCreate(req, res);
    case "itinerary/update":
      return itineraryUpdate(req, res);
    case "itinerary/done":
      return itineraryDone(req, res);
    case "itinerary/delete":
      return itineraryDelete(req, res);
    case "places/create":
      return placeCreate(req, res);
    case "places/update":
      return placeUpdate(req, res);
    case "places/visited":
      return placeVisited(req, res);
    case "places/delete":
      return placeDelete(req, res);
    case "checklist/create":
      return checklistCreate(req, res);
    case "checklist/done":
      return checklistDone(req, res);
    case "checklist/delete":
      return checklistDelete(req, res);
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
    res.status(200).json(EMPTY_TRIPS);
    return;
  }

  // Trips are scoped to the caller's group, same as goals. The rows query and
  // the summary aggregate run concurrently; see api/_lib/queries.ts.
  res.status(200).json(await tripsForGroup(user.groupId));
}

async function detail(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["GET"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(tripIdQuerySchema, req.query);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  // Four independent reads, fired together. The trip row is what authorizes
  // the response, but the other three have no data dependency on it — they
  // were only serial because `await` was written on each line, and on a cold
  // Neon start each extra round trip is a whole compute wake. Nothing is
  // returned unless the trip check below passes, so firing them ahead of the
  // authorization can't leak another group's plan.
  const [tripRows, itineraryItems, places, checklist] = await Promise.all([
    sql`
      select
        t.id, t.title, t.destination,
        t.start_date as "startDate",
        t.end_date as "endDate",
        t.budget,
        t.notes,
        t.created_by as "createdBy",
        u.display_name as "createdByName",
        u.email as "createdByEmail",
        t.created_at as "createdAt",
        coalesce(i.count, 0)::int as "itineraryCount"
      from trips t
      left join users u on u.id = t.created_by
      left join (
        select trip_id, count(*) as count from trip_itinerary_items where trip_id = ${id} group by trip_id
      ) i on i.trip_id = t.id
      where t.id = ${id} and t.group_id = ${user.groupId}
      limit 1
    `,
    sql`
      select
        ii.id,
        ii.trip_id as "tripId",
        ii.title,
        ii.category,
        ii.item_date as "itemDate",
        ii.item_time as "itemTime",
        ii.end_time as "endTime",
        ii.location,
        ii.notes,
        ii.cost,
        ii.url,
        ii.is_done as "isDone",
        ii.place_id as "placeId",
        p.name as "placeName",
        ii.created_by as "createdBy",
        u.display_name as "createdByName",
        u.email as "createdByEmail",
        ii.created_at as "createdAt"
      from trip_itinerary_items ii
      join users u on u.id = ii.created_by
      left join trip_places p on p.id = ii.place_id
      where ii.trip_id = ${id}
      order by ii.item_date asc nulls last, ii.item_time asc nulls last, ii.created_at asc
    `,
    sql`
      select
        pl.id,
        pl.trip_id as "tripId",
        pl.name,
        pl.category,
        pl.area,
        pl.notes,
        pl.url,
        pl.est_cost as "estCost",
        pl.is_priority as "isPriority",
        pl.is_visited as "isVisited",
        pl.created_by as "createdBy",
        pl.created_at as "createdAt",
        -- Whether this place already sits on the timeline. Answered here as an
        -- EXISTS rather than derived client-side, so the board can show
        -- "scheduled" without the caller having to scan every itinerary item.
        exists (select 1 from trip_itinerary_items s where s.place_id = pl.id) as "isScheduled"
      from trip_places pl
      where pl.trip_id = ${id}
      order by pl.is_visited asc, pl.is_priority desc, pl.created_at asc
    `,
    sql`
      select
        c.id,
        c.trip_id as "tripId",
        c.title,
        c.category,
        c.is_done as "isDone",
        c.created_by as "createdBy",
        c.created_at as "createdAt"
      from trip_checklist_items c
      where c.trip_id = ${id}
      order by c.is_done asc, c.created_at asc
    `,
  ]);

  const trip = tripRows[0];
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.status(200).json({ trip, itineraryItems, places, checklist });
}

/**
 * Confirms `tripId` names a trip in the caller's group. Every child-row write
 * (itinerary, place, checklist) needs this: the trip id alone isn't proof of
 * access, and none of those tables carries a group_id to filter on directly.
 */
async function tripInGroup(tripId: string, groupId: string | null): Promise<boolean> {
  if (!groupId) return false;
  const rows = await sql`select id from trips where id = ${tripId} and group_id = ${groupId} limit 1`;
  return rows.length > 0;
}

async function create(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!user.groupId) {
    res.status(403).json({ error: "Join or create a group before adding trips" });
    return;
  }

  const parsed = parseBody(createTripRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { title, destination, startDate, endDate, budget, notes } = parsed.data;

  const rows = await sql`
    insert into trips (title, destination, start_date, end_date, budget, notes, created_by, group_id)
    values (
      ${title}, ${destination ?? null}, ${startDate ?? null}, ${endDate ?? null},
      ${budget ?? null}, ${notes ?? null}, ${user.id}, ${user.groupId}
    )
    returning
      id, title, destination,
      start_date as "startDate",
      end_date as "endDate",
      budget,
      notes,
      created_by as "createdBy",
      created_at as "createdAt"
  `;

  const trip = { ...rows[0], createdByName: user.displayName, createdByEmail: user.email, itineraryCount: 0 };

  res.status(201).json({ trip });
}

// Edits a trip's fields. Group-scoped; the itinerary is untouched.
async function update(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(updateTripRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id, title, destination, startDate, endDate, budget, notes } = parsed.data;

  const rows = await sql`
    update trips set
      title = ${title},
      destination = ${destination ?? null},
      start_date = ${startDate ?? null},
      end_date = ${endDate ?? null},
      budget = ${budget ?? null},
      notes = ${notes ?? null},
      updated_at = now()
    where id = ${id} and group_id = ${user.groupId}
    returning id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.status(200).json({ ok: true });
}

// Deletes a trip and (via ON DELETE CASCADE) its itinerary items. Group-scoped.
async function remove(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(tripIdQuerySchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  const rows = await sql`
    delete from trips where id = ${id} and group_id = ${user.groupId} returning id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.status(200).json({ ok: true });
}

async function itineraryCreate(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(createItineraryItemRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { tripId, title, category, itemDate, itemTime, endTime, location, notes, cost, url, placeId } = parsed.data;

  if (!(await tripInGroup(tripId, user.groupId))) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const rows = await sql`
    insert into trip_itinerary_items
      (trip_id, title, category, item_date, item_time, end_time, location, notes, cost, url, place_id, created_by)
    values (
      ${tripId}, ${title}, ${category ?? null}, ${itemDate ?? null}, ${itemTime ?? null}, ${endTime ?? null},
      ${location ?? null}, ${notes ?? null}, ${cost ?? null}, ${url ?? null}, ${placeId ?? null}, ${user.id}
    )
    returning
      id,
      trip_id as "tripId",
      title,
      category,
      item_date as "itemDate",
      item_time as "itemTime",
      end_time as "endTime",
      location,
      notes,
      cost,
      url,
      is_done as "isDone",
      place_id as "placeId",
      created_by as "createdBy",
      created_at as "createdAt"
  `;

  const itineraryItem = { ...rows[0], createdByName: user.displayName, createdByEmail: user.email, placeName: null };

  res.status(201).json({ itineraryItem });
}

// Edits every field of a stop in one write. The group check rides along in the
// UPDATE's own `using trips` join rather than a separate SELECT first, so an
// edit stays a single round trip.
async function itineraryUpdate(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(updateItineraryItemRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id, title, category, itemDate, itemTime, endTime, location, notes, cost, url, placeId } = parsed.data;

  const rows = await sql`
    update trip_itinerary_items ii set
      title = ${title},
      category = ${category ?? null},
      item_date = ${itemDate ?? null},
      item_time = ${itemTime ?? null},
      end_time = ${endTime ?? null},
      location = ${location ?? null},
      notes = ${notes ?? null},
      cost = ${cost ?? null},
      url = ${url ?? null},
      place_id = ${placeId ?? null},
      updated_at = now()
    from trips t
    where ii.id = ${id} and ii.trip_id = t.id and t.group_id = ${user.groupId}
    returning ii.id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Itinerary item not found" });
    return;
  }

  res.status(200).json({ ok: true });
}

// The one-tap tick on the timeline. Deliberately its own endpoint: sending the
// whole row for a boolean would overwrite any edit the other person made
// between this screen's last load and the tap.
async function itineraryDone(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(setItineraryItemDoneRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id, isDone } = parsed.data;

  const rows = await sql`
    update trip_itinerary_items ii set is_done = ${isDone}, updated_at = now()
    from trips t
    where ii.id = ${id} and ii.trip_id = t.id and t.group_id = ${user.groupId}
    returning ii.id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Itinerary item not found" });
    return;
  }

  res.status(200).json({ ok: true });
}

async function itineraryDelete(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(itineraryItemIdSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  // Join back through trips to confirm the item belongs to the caller's
  // group — the item's own row has no group_id to check directly.
  const rows = await sql`
    delete from trip_itinerary_items ii
    using trips t
    where ii.id = ${id} and ii.trip_id = t.id and t.group_id = ${user.groupId}
    returning ii.id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Itinerary item not found" });
    return;
  }

  res.status(200).json({ ok: true });
}

// ---------------------------------------------------------------------------
// Places — the board of candidates for a trip, separate from the timeline of
// commitments. Every write is authorized by joining back through `trips`,
// exactly as the itinerary writes are.
// ---------------------------------------------------------------------------

async function placeCreate(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(createTripPlaceRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { tripId, name, category, area, notes, url, estCost, isPriority } = parsed.data;

  if (!(await tripInGroup(tripId, user.groupId))) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const rows = await sql`
    insert into trip_places (trip_id, name, category, area, notes, url, est_cost, is_priority, created_by)
    values (
      ${tripId}, ${name}, ${category ?? null}, ${area ?? null}, ${notes ?? null},
      ${url ?? null}, ${estCost ?? null}, ${isPriority ?? false}, ${user.id}
    )
    returning
      id,
      trip_id as "tripId",
      name,
      category,
      area,
      notes,
      url,
      est_cost as "estCost",
      is_priority as "isPriority",
      is_visited as "isVisited",
      created_by as "createdBy",
      created_at as "createdAt"
  `;

  // A place cannot already be on the timeline the moment it's created.
  res.status(201).json({ place: { ...rows[0], isScheduled: false } });
}

async function placeUpdate(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(updateTripPlaceRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id, name, category, area, notes, url, estCost, isPriority } = parsed.data;

  const rows = await sql`
    update trip_places pl set
      name = ${name},
      category = ${category ?? null},
      area = ${area ?? null},
      notes = ${notes ?? null},
      url = ${url ?? null},
      est_cost = ${estCost ?? null},
      is_priority = ${isPriority ?? false},
      updated_at = now()
    from trips t
    where pl.id = ${id} and pl.trip_id = t.id and t.group_id = ${user.groupId}
    returning pl.id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Place not found" });
    return;
  }

  res.status(200).json({ ok: true });
}

async function placeVisited(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(setTripPlaceVisitedRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id, isVisited } = parsed.data;

  const rows = await sql`
    update trip_places pl set is_visited = ${isVisited}, updated_at = now()
    from trips t
    where pl.id = ${id} and pl.trip_id = t.id and t.group_id = ${user.groupId}
    returning pl.id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Place not found" });
    return;
  }

  res.status(200).json({ ok: true });
}

async function placeDelete(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(tripPlaceIdSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  // Any itinerary stop scheduled from this place keeps its own title, date and
  // notes — `place_id` is ON DELETE SET NULL, so removing a candidate from the
  // board never silently deletes a commitment from the timeline.
  const rows = await sql`
    delete from trip_places pl
    using trips t
    where pl.id = ${id} and pl.trip_id = t.id and t.group_id = ${user.groupId}
    returning pl.id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Place not found" });
    return;
  }

  res.status(200).json({ ok: true });
}

// ---------------------------------------------------------------------------
// Prep checklist
// ---------------------------------------------------------------------------

async function checklistCreate(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(createChecklistItemRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { tripId, title, category } = parsed.data;

  if (!(await tripInGroup(tripId, user.groupId))) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const rows = await sql`
    insert into trip_checklist_items (trip_id, title, category, created_by)
    values (${tripId}, ${title}, ${category ?? null}, ${user.id})
    returning
      id,
      trip_id as "tripId",
      title,
      category,
      is_done as "isDone",
      created_by as "createdBy",
      created_at as "createdAt"
  `;

  res.status(201).json({ item: rows[0] });
}

async function checklistDone(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(setChecklistItemDoneRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id, isDone } = parsed.data;

  const rows = await sql`
    update trip_checklist_items c set is_done = ${isDone}, updated_at = now()
    from trips t
    where c.id = ${id} and c.trip_id = t.id and t.group_id = ${user.groupId}
    returning c.id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Checklist item not found" });
    return;
  }

  res.status(200).json({ ok: true });
}

async function checklistDelete(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(checklistItemIdSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  const rows = await sql`
    delete from trip_checklist_items c
    using trips t
    where c.id = ${id} and c.trip_id = t.id and t.group_id = ${user.groupId}
    returning c.id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Checklist item not found" });
    return;
  }

  res.status(200).json({ ok: true });
}
