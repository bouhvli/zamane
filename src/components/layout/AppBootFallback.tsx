import { useEffect, useState } from "react";

import { AmbientField } from "./AmbientField";
import { HomeSkeleton } from "./Skeleton";

// Shown by the root route's HydrateFallback while the very first request is in
// flight — the gap between the PWA icon being tapped and React Router's first
// real paint. That gap is dominated by the database's cold start (~3s on a
// suspended compute, against ~50ms once warm), so it is worth designing for
// rather than papering over.
//
// It used to be a spinner and a rotating joke on an empty page. It is now the
// shape of Home: the layout is already settled when the data lands, so nothing
// jumps, and the wait reads as the app opening rather than the app stalling.
// The line of copy stays — it is the one place in the product where a slow
// moment gets to be charming — but it now sits under a screen that is visibly
// becoming something.
const MESSAGES = [
  "Waking up the piggy bank…",
  "Untangling the shopping list…",
  "Convincing the trip budget to cooperate…",
  "Counting shared coins…",
  "Syncing your plans (and your snacks)…",
  "Politely asking the server to hurry…",
  "Double-checking who forgot the toothpaste…",
  "Packing the bags one more time…",
];

const INTERVAL_MS = 1700;

export function AppBootFallback() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % MESSAGES.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans">
      <AmbientField />
      <div className="ambient-content">
        <HomeSkeleton />
        <p
          key={index}
          role="status"
          className="animate-in fade-in-0 mx-auto mt-8 max-w-md px-4 pb-12 text-center text-sm text-muted-foreground duration-500"
        >
          {MESSAGES[index]}
        </p>
      </div>
    </div>
  );
}
