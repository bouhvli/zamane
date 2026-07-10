import { apiFetch } from "./api";

export type GroupMember = { id: string; displayName: string | null; email: string };
export type Group = { id: string; inviteCode: string; members?: GroupMember[] };

export function fetchGroup() {
  return apiFetch<{ group: Group | null }>("/api/groups/me");
}

export function createGroup() {
  return apiFetch<{ group: Group }>("/api/groups/create", { method: "POST" });
}

export function joinGroup(inviteCode: string) {
  return apiFetch<{ group: Group }>("/api/groups/join", { method: "POST", body: { inviteCode } });
}
