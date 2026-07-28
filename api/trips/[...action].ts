import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  tripIdQuerySchema,
  createTripRequestSchema,
  updateTripRequestSchema,
  createItineraryItemRequestSchema,
  itineraryItemIdSchema,
} from "../../shared/validation.js";

import { sql } from "../_lib/db.js";
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
    case "itinerary/delete":
      return itineraryDelete(req, res);
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
    res.status(200).json({ trips: [], summary: { upcomingCount: 0, totalBudget: 0 } });
    return;
  }

  // Trips are scoped to the caller's group, same as goals.
  const trips = await sql`
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
      select trip_id, count(*) as count from trip_itinerary_items group by trip_id
    ) i on i.trip_id = t.id
    where t.group_id = ${user.groupId}
    order by t.start_date asc nulls last, t.created_at desc
  `;

  const [{ upcomingCount, totalBudget }] = await sql`
    select
      count(*) filter (where end_date is null or end_date >= current_date)::int as "upcomingCount",
      coalesce(sum(budget), 0) as "totalBudget"
    from trips
    where group_id = ${user.groupId}
  `;

  res.status(200).json({ trips, summary: { upcomingCount, totalBudget } });
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

  const rows = await sql`
    select
      t.id, t.title, t.destination,
      t.start_date as "startDate",
      t.end_date as "endDate",
      t.budget,
      t.notes,
      t.created_by as "createdBy",
      u.display_name as "createdByName",
      u.email as "createdByEmail",
      t.created_at as "createdAt"
    from trips t
    left join users u on u.id = t.created_by
    where t.id = ${id} and t.group_id = ${user.groupId}
    limit 1
  `;

  const trip = rows[0];
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const itineraryItems = await sql`
    select
      ii.id,
      ii.trip_id as "tripId",
      ii.title,
      ii.item_date as "itemDate",
      ii.item_time as "itemTime",
      ii.location,
      ii.notes,
      ii.created_by as "createdBy",
      u.display_name as "createdByName",
      u.email as "createdByEmail",
      ii.created_at as "createdAt"
    from trip_itinerary_items ii
    join users u on u.id = ii.created_by
    where ii.trip_id = ${id}
    order by ii.item_date asc nulls last, ii.item_time asc nulls last, ii.created_at asc
  `;

  res.status(200).json({ trip, itineraryItems });
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
  const { tripId, title, itemDate, itemTime, location, notes } = parsed.data;

  // Confirm the trip is in the caller's group before attaching an item to
  // it — the trip id alone isn't proof of access.
  const tripRows = await sql`select id from trips where id = ${tripId} and group_id = ${user.groupId} limit 1`;
  if (tripRows.length === 0) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const rows = await sql`
    insert into trip_itinerary_items (trip_id, title, item_date, item_time, location, notes, created_by)
    values (${tripId}, ${title}, ${itemDate ?? null}, ${itemTime ?? null}, ${location ?? null}, ${notes ?? null}, ${user.id})
    returning
      id,
      trip_id as "tripId",
      title,
      item_date as "itemDate",
      item_time as "itemTime",
      location,
      notes,
      created_by as "createdBy",
      created_at as "createdAt"
  `;

  const itineraryItem = { ...rows[0], createdByName: user.displayName, createdByEmail: user.email };

  res.status(201).json({ itineraryItem });
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
