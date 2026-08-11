import { useEffect, useState } from "react";

import { Loader } from "@/components/Loader";

// Shown by the root route's HydrateFallback while the very first loader
// (the session check) is in flight — the gap between the PWA icon being
// tapped and React Router's first real paint, which on a cold serverless
// function can run 3-6s. Without this, that gap is a blank white screen.
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6">
      <Loader size={72} />
      <p
        key={index}
        className="animate-in fade-in-0 duration-500 text-center text-sm text-muted-foreground"
      >
        {MESSAGES[index]}
      </p>
    </div>
  );
}
