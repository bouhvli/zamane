import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * The bottom-sheet chrome, extracted once.
 *
 * The organizer opens four sheets (a stop, a place, a prep line, the add
 * chooser) and they were all going to repeat the same twenty lines: drive a
 * native `<dialog>` from a prop, route Escape and backdrop clicks back through
 * state, paint a grabber, and lay out a header. Repeating that is how three
 * sheets end up with three slightly different dismiss behaviours.
 *
 * A native `<dialog>` rather than a div: focus trapping, Escape, inertness of
 * the page behind it and the `::backdrop` pseudo-element all come for free and
 * correctly, which no hand-rolled overlay manages on the first try.
 */
export function SheetShell({
  open,
  onClose,
  title,
  /** True while a submit is in flight — the sheet refuses to close so a
   *  half-written request can't lose its own UI. */
  locked,
  /** Focused when the sheet opens. Without it focus lands on the close button,
   *  which is the one control nobody opened the sheet to press. */
  autoFocusRef,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  locked?: boolean;
  autoFocusRef?: React.RefObject<HTMLElement>;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      if (autoFocusRef?.current) {
        // After the browser has done its own initial focus, or it wins.
        requestAnimationFrame(() => autoFocusRef.current?.focus());
      }
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, autoFocusRef]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="sheet-dialog glass-4"
      onCancel={(event) => {
        // Route native Escape through our own state so `open` stays the single
        // source of truth and can't drift from what's on screen.
        event.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(event) => {
        // A click that lands on the dialog element itself is a click on the
        // backdrop — the content sits in the children below.
        if (event.target === ref.current && !locked) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="shrink-0 px-5 pt-3 pb-3">
          <div aria-hidden="true" className="sheet-grabber mx-auto mb-3" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="min-w-0 truncate text-lg font-bold tracking-tight text-foreground">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              disabled={locked}
              className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {children}
      </div>
    </dialog>
  );
}
