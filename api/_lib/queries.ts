import { sql } from "./db.js";

/**
 * The group-scoped read queries, extracted from the four list endpoints so
 * `/api/home` can run all of them in one invocation without duplicating SQL.
 *
 * Every function here fires its independent queries with `Promise.all`. The
 * Neon HTTP driver issues one request per query with no pool to contend for,
 * so a list that used to cost three sequential round trips (rows, then
 * counts, then a sum) now costs one — the queries have no data dependency on
 * each other, they were only serial because `await` was written on each line.
 */

export type GoalsPayload = {
  goals: unknown[];
  summary: { activeCount: number; completedCount: number; totalSavedThisMonth: string | number };
};

export const EMPTY_GOALS: GoalsPayload = {
  goals: [],
  summary: { activeCount: 0, completedCount: 0, totalSavedThisMonth: 0 },
};

export async function goalsForGroup(groupId: string): Promise<GoalsPayload> {
  const [goals, [counts], [monthly]] = await Promise.all([
    sql`
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
      where g.group_id = ${groupId}
      order by g.is_completed asc, g.created_at desc
    `,
    sql`
      select
        count(*) filter (where not is_completed)::int as "activeCount",
        count(*) filter (where is_completed)::int as "completedCount"
      from goals
      where group_id = ${groupId}
    `,
    sql`
      select coalesce(sum(gc.amount), 0) as "totalSavedThisMonth"
      from goal_contributions gc
      join goals gl on gl.id = gc.goal_id
      where gl.group_id = ${groupId}
        and gc.amount is not null
        and gc.created_at >= date_trunc('month', now())
    `,
  ]);

  return {
    goals,
    summary: {
      activeCount: (counts as { activeCount: number }).activeCount,
      completedCount: (counts as { completedCount: number }).completedCount,
      totalSavedThisMonth: (monthly as { totalSavedThisMonth: string }).totalSavedThisMonth,
    },
  };
}

export type TripsPayload = {
  trips: unknown[];
  summary: { upcomingCount: number; totalBudget: string | number };
};

export const EMPTY_TRIPS: TripsPayload = {
  trips: [],
  summary: { upcomingCount: 0, totalBudget: 0 },
};

export async function tripsForGroup(groupId: string): Promise<TripsPayload> {
  const [trips, [summary]] = await Promise.all([
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
        select trip_id, count(*) as count from trip_itinerary_items group by trip_id
      ) i on i.trip_id = t.id
      where t.group_id = ${groupId}
      order by t.start_date asc nulls last, t.created_at desc
    `,
    sql`
      select
        count(*) filter (where end_date is null or end_date >= current_date)::int as "upcomingCount",
        coalesce(sum(budget), 0) as "totalBudget"
      from trips
      where group_id = ${groupId}
    `,
  ]);

  const { upcomingCount, totalBudget } = summary as { upcomingCount: number; totalBudget: string };
  return { trips, summary: { upcomingCount, totalBudget } };
}

export type ShoppingPayload = {
  items: unknown[];
  summary: { uncheckedCount: number; checkedCount: number; estimatedTotal: string | number };
};

export const EMPTY_SHOPPING: ShoppingPayload = {
  items: [],
  summary: { uncheckedCount: 0, checkedCount: 0, estimatedTotal: 0 },
};

export async function shoppingForGroup(groupId: string): Promise<ShoppingPayload> {
  const [items, [summary]] = await Promise.all([
    sql`
      select
        si.id, si.name, si.quantity, si.category, si.price, si.notes,
        si.is_checked as "isChecked",
        si.created_by as "createdBy",
        u.display_name as "createdByName",
        u.email as "createdByEmail",
        si.created_at as "createdAt"
      from shopping_items si
      left join users u on u.id = si.created_by
      where si.group_id = ${groupId}
      order by si.is_checked asc, si.category asc nulls last, si.created_at asc
    `,
    sql`
      select
        count(*) filter (where not is_checked)::int as "uncheckedCount",
        count(*) filter (where is_checked)::int as "checkedCount",
        coalesce(sum(price * quantity) filter (where not is_checked and price is not null), 0) as "estimatedTotal"
      from shopping_items
      where group_id = ${groupId}
    `,
  ]);

  const { uncheckedCount, checkedCount, estimatedTotal } = summary as {
    uncheckedCount: number;
    checkedCount: number;
    estimatedTotal: string;
  };
  return { items, summary: { uncheckedCount, checkedCount, estimatedTotal } };
}

export type GroupPayload = { group: { id: string; inviteCode: string; members: unknown[] } | null };

export async function groupForGroupId(groupId: string): Promise<GroupPayload> {
  const [groupRows, members] = await Promise.all([
    sql`select id, invite_code as "inviteCode" from groups where id = ${groupId} limit 1`,
    sql`
      select id, display_name as "displayName", email
      from users
      where group_id = ${groupId}
      order by created_at asc
    `,
  ]);

  const group = groupRows[0] as { id: string; inviteCode: string } | undefined;
  return group ? { group: { ...group, members } } : { group: null };
}
