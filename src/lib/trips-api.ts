import { apiFetch } from "./api";
import type { CreateTripRequest, UpdateTripRequest, CreateItineraryItemRequest } from "@shared/validation";

// Postgres `numeric` columns come back as strings — parse with Number() at
// display time (see budget below).
export type Trip = {
  id: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: string | null;
  notes: string | null;
  /** Public URL of the trip's cover photo (e.g. from Vercel Blob). Optional
   *  until the upload flow + `cover_image_url` column land; the card falls
   *  back to a branded gradient cover when it's absent. */
  coverImageUrl?: string | null;
  itineraryCount: number;
  createdBy?: string;
  createdByName?: string | null;
  createdByEmail?: string;
  createdAt: string;
};

export type TripsSummary = {
  upcomingCount: number;
  totalBudget: string;
};

export type ItineraryItem = {
  id: string;
  tripId: string;
  title: string;
  itemDate: string | null;
  itemTime: string | null;
  location: string | null;
  notes: string | null;
  createdBy: string;
  createdByName: string | null;
  createdByEmail: string;
  createdAt: string;
};

// List reads for this resource come from `/api/home` via dashboard.ts, not from
// a fetcher here: the Neon instance suspends when idle and the first query after
// that pays the compute wake, so the app takes one request for everything rather
// than one per tab. The server's list endpoint still exists and still works —
// nothing on the client calls it.

export function fetchTripDetail(id: string) {
  return apiFetch<{ trip: Trip; itineraryItems: ItineraryItem[] }>(`/api/trips/detail?id=${encodeURIComponent(id)}`);
}

export function createTrip(data: CreateTripRequest) {
  return apiFetch<{ trip: Trip }>("/api/trips/create", { method: "POST", body: data });
}

export function updateTrip(data: UpdateTripRequest) {
  return apiFetch<{ ok: true }>("/api/trips/update", { method: "POST", body: data });
}

export function deleteTrip(id: string) {
  return apiFetch<{ ok: true }>("/api/trips/delete", { method: "POST", body: { id } });
}

export function addItineraryItem(data: CreateItineraryItemRequest) {
  return apiFetch<{ itineraryItem: ItineraryItem }>("/api/trips/itinerary/create", { method: "POST", body: data });
}

export function deleteItineraryItem(id: string) {
  return apiFetch<{ ok: true }>("/api/trips/itinerary/delete", { method: "POST", body: { id } });
}
