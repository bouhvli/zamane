import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "./api";

/**
 * A boolean that flips instantly and reconciles with the server afterwards.
 *
 * Every tick in the trip organizer — a stop done, a place visited, a packing
 * line crossed off — is a one-tap, low-stakes, reversible action, which is
 * exactly the case optimistic UI is for. Waiting for a round trip before
 * drawing the checkmark would make the whole prep list feel laggy on the
 * connection a trip is actually planned over, and the failure mode (a tick
 * that reverts with a toast) is cheap.
 *
 * The local override is dropped as soon as the revalidated server value
 * agrees, so the row goes back to being driven by loader data rather than
 * holding a stale opinion of its own.
 *
 * Deliberately NOT used for deletes: those are irreversible server-side and
 * get the grace-window treatment in use-undoable-delete instead.
 */
export function useOptimisticToggle(
  serverValue: boolean,
  commit: (next: boolean) => Promise<unknown>,
  onSettled: () => void,
  errorMessage = "Couldn't save that. Please try again.",
): readonly [boolean, (next: boolean) => void, boolean] {
  const [override, setOverride] = useState<boolean | null>(null);
  const [inFlight, setInFlight] = useState(false);

  // Latest callbacks in refs so `toggle` keeps a stable identity across
  // renders and doesn't re-create every list row's handler on each revalidate.
  const commitRef = useRef(commit);
  const onSettledRef = useRef(onSettled);
  const errorRef = useRef(errorMessage);
  commitRef.current = commit;
  onSettledRef.current = onSettled;
  errorRef.current = errorMessage;

  useEffect(() => {
    if (override !== null && override === serverValue) setOverride(null);
  }, [override, serverValue]);

  const toggle = useCallback((next: boolean) => {
    setOverride(next);
    setInFlight(true);
    void (async () => {
      try {
        await commitRef.current(next);
        onSettledRef.current();
      } catch (error) {
        // Snap back to the server's truth and say why, rather than leaving a
        // tick on screen that was never persisted.
        setOverride(null);
        toast.error(error instanceof ApiError ? error.message : errorRef.current);
      } finally {
        setInFlight(false);
      }
    })();
  }, []);

  return [override ?? serverValue, toggle, inFlight] as const;
}
