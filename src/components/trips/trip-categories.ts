import {
  Backpack,
  BedDouble,
  BookMarked,
  CalendarCheck,
  CircleDot,
  Landmark,
  MapPin,
  Plane,
  Ticket,
  TramFront,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { TripCategory, ChecklistCategory } from "@/lib/trips-api";

/**
 * What kind of thing a stop or a place is.
 *
 * Deliberately NOT seven colours. Seven hues on one screen is a rainbow, and
 * this palette has exactly two brand hues plus two semantic ones — a per-kind
 * colour would have to invent five more, and every one of them would be
 * decoration rather than state (see the product register: accent is for
 * primary action, selection and state, not for labelling).
 *
 * So kind is carried by the ICON and the word, and colour is left free to mean
 * something: violet = happening now / next up, success = done. Two independent
 * dimensions, no new hues.
 */
export type TripCategoryMeta = {
  value: TripCategory;
  label: string;
  icon: LucideIcon;
  /** Placeholder shown in the activity sheet once this kind is chosen — the
   *  fastest way to teach what belongs in a field is to show an example of it. */
  hint: string;
};

export const TRIP_CATEGORIES: TripCategoryMeta[] = [
  { value: "flight", label: "Flight", icon: Plane, hint: "e.g. AT 210 — Casablanca → Oslo" },
  { value: "transport", label: "Transport", icon: TramFront, hint: "e.g. Airport train to the centre" },
  { value: "stay", label: "Stay", icon: BedDouble, hint: "e.g. Check in at Hotel Bristol" },
  { value: "food", label: "Food", icon: UtensilsCrossed, hint: "e.g. Dinner at Maaemo" },
  { value: "sight", label: "Sight", icon: Landmark, hint: "e.g. Vigeland Sculpture Park" },
  { value: "activity", label: "Activity", icon: Ticket, hint: "e.g. Fjord kayaking" },
  { value: "other", label: "Other", icon: CircleDot, hint: "e.g. Pick up the rental car" },
];

const CATEGORY_BY_VALUE = new Map(TRIP_CATEGORIES.map((c) => [c.value, c]));

/*
 * The three lookups take a loose `string` rather than TripCategory on purpose.
 * Their callers hold a category from three places — a validated row, a form
 * field that can be "", and a raw grouping key off a SQL result — and a Map
 * miss already has a correct answer for all of them. Narrowing the parameter
 * would only move that fact into a cast at every call site.
 */

/** Falls back to the map pin when no kind was chosen — capturing an idea must
 *  never require classifying it first. */
export function categoryIcon(category: string | null | undefined): LucideIcon {
  return (category && CATEGORY_BY_VALUE.get(category as TripCategory)?.icon) || MapPin;
}

export function categoryLabel(category: string | null | undefined): string | null {
  return (category && CATEGORY_BY_VALUE.get(category as TripCategory)?.label) ?? null;
}

export function categoryHint(category: string | null | undefined): string {
  return (category && CATEGORY_BY_VALUE.get(category as TripCategory)?.hint) || "e.g. Visit the fjords";
}

/**
 * Prep buckets. Fixed rather than free text: two people typing their own
 * category names produce a list that groups into nothing.
 */
export type ChecklistCategoryMeta = {
  value: ChecklistCategory;
  label: string;
  icon: LucideIcon;
};

export const CHECKLIST_CATEGORIES: ChecklistCategoryMeta[] = [
  { value: "packing", label: "Packing", icon: Backpack },
  { value: "documents", label: "Documents", icon: BookMarked },
  { value: "bookings", label: "Bookings", icon: CalendarCheck },
  { value: "todo", label: "To do", icon: CircleDot },
];

const CHECKLIST_BY_VALUE = new Map(CHECKLIST_CATEGORIES.map((c) => [c.value, c]));

export function checklistMeta(category: string | null | undefined): ChecklistCategoryMeta {
  return (category && CHECKLIST_BY_VALUE.get(category as ChecklistCategory)) || CHECKLIST_CATEGORIES[3];
}
