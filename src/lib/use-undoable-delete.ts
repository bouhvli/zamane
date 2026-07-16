import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";

// How long the row stays hidden and the "Undo" toast stays up before the
// delete is actually sent to the server. Deletes here are irreversible on the
// server (no soft-delete / restore endpoint), so the guardrail is a client
// grace window: hide optimistically, let the user take it back, and only
// then commit. This keeps one-tap speed while making every delete reversible.
const UNDO_WINDOW_MS = 5000;

export type UndoableDelete = {
  /** Ids currently hidden pending commit — filter these out of the rendered list. */
  pendingIds: ReadonlySet<string>;
  /** Hide `id`, show an Undo toast, and commit after the grace window. */
  requestDelete: (id: string, message: string) => void;
};

/**
 * Delayed-commit delete with a toast-based undo. Shared by the shopping list,
 * trip itinerary, and contribution history so every destructive action in the
 * app behaves the same way (one form grammar, one delete grammar).
 *
 * `commit` performs the real API delete; `onCommitted` is called after a
 * successful commit (typically a revalidate) so derived server state refreshes.
 */
export function useUndoableDelete({
  commit,
  onCommitted,
  errorMessage = "Something went wrong. Please try again.",
}: {
  commit: (id: string) => Promise<unknown>;
  onCommitted: () => void;
  errorMessage?: string;
}): UndoableDelete {
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());

  // Timers and the latest callbacks live in refs so the unmount flush can run
  // without re-subscribing an effect (and firing cleanup) on every render.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const commitRef = useRef(commit);
  const onCommittedRef = useRef(onCommitted);
  const errorMessageRef = useRef(errorMessage);
  commitRef.current = commit;
  onCommittedRef.current = onCommitted;
  errorMessageRef.current = errorMessage;

  const unhide = useCallback((id: string) => {
    setPendingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const runCommit = useCallback(
    async (id: string) => {
      timers.current.delete(id);
      try {
        await commitRef.current(id);
        onCommittedRef.current();
      } catch (error) {
        // Commit failed — surface it and bring the row back so the user can retry.
        toast.error(error instanceof ApiError ? error.message : errorMessageRef.current);
        unhide(id);
      }
    },
    [unhide],
  );

  const requestDelete = useCallback(
    (id: string, message: string) => {
      if (timers.current.has(id)) return; // ignore double taps within the window
      setPendingIds((prev) => new Set(prev).add(id));
      const timer = setTimeout(() => void runCommit(id), UNDO_WINDOW_MS);
      timers.current.set(id, timer);
      toast(message, {
        duration: UNDO_WINDOW_MS,
        action: {
          label: "Undo",
          onClick: () => {
            clearTimeout(timer);
            timers.current.delete(id);
            unhide(id);
          },
        },
      });
    },
    [runCommit, unhide],
  );

  // On unmount, commit anything still pending so leaving the screen doesn't
  // silently abandon a delete the user already asked for.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const [id, timer] of pending) {
        clearTimeout(timer);
        void commitRef.current(id);
      }
      pending.clear();
    };
  }, []);

  return { pendingIds, requestDelete };
}
