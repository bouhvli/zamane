import { apiFetch } from "./api";
import type {
  CreateTripRequest,
  UpdateTripRequest,
  CreateItineraryItemInput,
  UpdateItineraryItemInput,
  CreateTripPlaceInput,
  UpdateTripPlaceInput,
  CreateChecklistItemInput,
  TripCategory,
  ChecklistCategory,
} from "@shared/validation";

export type { TripCategory, ChecklistCategory };

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

/** One committed stop on the timeline. Everything below `title` is optional:
 *  a plan starts as a list of ideas and firms up as the trip approaches. */
export type ItineraryItem = {
  id: string;
  tripId: string;
  title: string;
  category: TripCategory | null;
  itemDate: string | null;
  itemTime: string | null;
  /** Lets a stop occupy a span rather than an instant — what makes
   *  "happening now" answerable instead of guessed. */
  endTime: string | null;
  location: string | null;
  notes: string | null;
  cost: string | null;
  url: string | null;
  isDone: boolean;
  placeId: string | null;
  /** Denormalized on read so a scheduled stop can show which place it
   *  realizes without the client cross-referencing the places board. */
  placeName: string | null;
  createdBy: string;
  createdByName: string | null;
  createdByEmail: string;
  createdAt: string;
};

/** A candidate on the places board — somewhere you want to go, not yet a
 *  commitment on a specific day. Scheduling one creates an ItineraryItem
 *  pointing back at it. */
export type TripPlace = {
  id: string;
  tripId: string;
  name: string;
  category: TripCategory | null;
  area: string | null;
  notes: string | null;
  url: string | null;
  estCost: string | null;
  isPriority: boolean;
  isVisited: boolean;
  /** True once any itinerary item references this place. */
  isScheduled: boolean;
  createdBy: string;
  createdAt: string;
};

export type ChecklistItem = {
  id: string;
  tripId: string;
  title: string;
  category: ChecklistCategory | null;
  isDone: boolean;
  createdBy: string;
  createdAt: string;
};

export type TripDetail = {
  trip: Trip;
  itineraryItems: ItineraryItem[];
  places: TripPlace[];
  checklist: ChecklistItem[];
};

export function fetchTrips() {
  return apiFetch<{ trips: Trip[]; summary: TripsSummary }>("/api/trips/list");
}

export function fetchTripDetail(id: string) {
  return apiFetch<TripDetail>(`/api/trips/detail?id=${encodeURIComponent(id)}`);
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

export function addItineraryItem(data: CreateItineraryItemInput) {
  return apiFetch<{ itineraryItem: ItineraryItem }>("/api/trips/itinerary/create", { method: "POST", body: data });
}

export function deleteItineraryItem(id: string) {
  return apiFetch<{ ok: true }>("/api/trips/itinerary/delete", { method: "POST", body: { id } });
}

export function updateItineraryItem(data: UpdateItineraryItemInput) {
  return apiFetch<{ ok: true }>("/api/trips/itinerary/update", { method: "POST", body: data });
}

/** The one-tap tick on the timeline. Its own endpoint rather than a full
 *  update so a toggle can't clobber an edit made on the other phone. */
export function setItineraryItemDone(id: string, isDone: boolean) {
  return apiFetch<{ ok: true }>("/api/trips/itinerary/done", { method: "POST", body: { id, isDone } });
}

export function addTripPlace(data: CreateTripPlaceInput) {
  return apiFetch<{ place: TripPlace }>("/api/trips/places/create", { method: "POST", body: data });
}

export function updateTripPlace(data: UpdateTripPlaceInput) {
  return apiFetch<{ ok: true }>("/api/trips/places/update", { method: "POST", body: data });
}

export function setTripPlaceVisited(id: string, isVisited: boolean) {
  return apiFetch<{ ok: true }>("/api/trips/places/visited", { method: "POST", body: { id, isVisited } });
}

export function deleteTripPlace(id: string) {
  return apiFetch<{ ok: true }>("/api/trips/places/delete", { method: "POST", body: { id } });
}

export function addChecklistItem(data: CreateChecklistItemInput) {
  return apiFetch<{ item: ChecklistItem }>("/api/trips/checklist/create", { method: "POST", body: data });
}

export function setChecklistItemDone(id: string, isDone: boolean) {
  return apiFetch<{ ok: true }>("/api/trips/checklist/done", { method: "POST", body: { id, isDone } });
}

export function deleteChecklistItem(id: string) {
  return apiFetch<{ ok: true }>("/api/trips/checklist/delete", { method: "POST", body: { id } });
}
