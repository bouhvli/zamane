import { apiFetch } from "./api";
import type { CreateShoppingItemRequest } from "@shared/validation";

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: number;
  category: string | null;
  price: string | null;
  notes: string | null;
  isChecked: boolean;
  createdBy?: string;
  createdByName?: string | null;
  createdByEmail?: string;
  createdAt: string;
};

export type ShoppingSummary = {
  uncheckedCount: number;
  checkedCount: number;
  estimatedTotal: string;
};

// List reads for this resource come from `/api/home` via dashboard.ts, not from
// a fetcher here: the Neon instance suspends when idle and the first query after
// that pays the compute wake, so the app takes one request for everything rather
// than one per tab. The server's list endpoint still exists and still works —
// nothing on the client calls it.

export function createShoppingItem(data: CreateShoppingItemRequest) {
  return apiFetch<{ item: ShoppingItem }>("/api/shopping/create", { method: "POST", body: data });
}

export function toggleShoppingItem(id: string, isChecked: boolean) {
  return apiFetch<{ ok: true }>("/api/shopping/toggle", { method: "POST", body: { id, isChecked } });
}

export function deleteShoppingItem(id: string) {
  return apiFetch<{ ok: true }>("/api/shopping/delete", { method: "POST", body: { id } });
}
