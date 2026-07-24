import type { Trip } from "./trips-api";

// Auto destination photos — no upload, no storage service. When a trip has no
// explicit cover, we derive a Creative-Commons photo from its destination via
// LoremFlickr, which is keyless and returns a real image URL usable directly in
// an <img>. The `lock` seed is derived from the trip id so a given trip always
// shows the SAME photo instead of reshuffling on every render or navigation.
//
// To swap in a curated source later (e.g. the Unsplash API, which needs an API
// key + a small server proxy to hide it), change ONLY `tripCoverUrl` below —
// the card consumes whatever URL it returns, unchanged.

const PHOTO_W = 800;
const PHOTO_H = 500;

// djb2 — a small, stable, dependency-free string hash. Same id → same seed →
// same photo across sessions and devices.
function seedFromId(id: string): number {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) + hash + id.charCodeAt(i)) >>> 0;
  return (hash % 1000) + 1;
}

// Turn "Oslo, Norway" into "oslo,norway" — up to three lowercase tags for the
// image search, stripped of anything that isn't a word so the URL stays clean.
function destinationTags(destination: string): string {
  return destination
    .toLowerCase()
    .replace(/[^a-z0-9, ]/g, " ")
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(",");
}

/** The cover to show for a trip: an explicit uploaded URL if one is ever set,
 *  otherwise an auto destination photo, otherwise null (the card then renders
 *  its branded gradient fallback). */
export function tripCoverUrl(trip: Pick<Trip, "id" | "destination" | "coverImageUrl">): string | null {
  if (trip.coverImageUrl) return trip.coverImageUrl;
  if (!trip.destination) return null;
  const tags = destinationTags(trip.destination);
  if (!tags) return null;
  return `https://loremflickr.com/${PHOTO_W}/${PHOTO_H}/${tags}?lock=${seedFromId(trip.id)}`;
}
