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

export function fetchShoppingItems() {
  return apiFetch<{ items: ShoppingItem[]; summary: ShoppingSummary }>("/api/shopping/list");
}

export function createShoppingItem(data: CreateShoppingItemRequest) {
  return apiFetch<{ item: ShoppingItem }>("/api/shopping/create", { method: "POST", body: data });
}

export function toggleShoppingItem(id: string, isChecked: boolean) {
  return apiFetch<{ ok: true }>("/api/shopping/toggle", { method: "POST", body: { id, isChecked } });
}

export function deleteShoppingItem(id: string) {
  return apiFetch<{ ok: true }>("/api/shopping/delete", { method: "POST", body: { id } });
}
