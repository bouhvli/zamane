import { apiFetch } from "./api";

export type GroupMember = { id: string; displayName: string | null; email: string };
export type Group = { id: string; inviteCode: string; members?: GroupMember[] };

// List reads for this resource come from `/api/home` via dashboard.ts, not from
// a fetcher here: the Neon instance suspends when idle and the first query after
// that pays the compute wake, so the app takes one request for everything rather
// than one per tab. The server's list endpoint still exists and still works —
// nothing on the client calls it.

export function createGroup() {
  return apiFetch<{ group: Group }>("/api/groups/create", { method: "POST" });
}

export function joinGroup(inviteCode: string) {
  return apiFetch<{ group: Group }>("/api/groups/join", { method: "POST", body: { inviteCode } });
}
