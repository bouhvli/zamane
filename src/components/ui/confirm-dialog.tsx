import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "./button";

// A minimal confirmation modal built on the native <dialog> element — it gives
// focus trapping, Escape-to-dismiss, and a backdrop for free, and (unlike an
// absolutely-positioned div) can't be clipped by an ancestor's overflow. Used
// for the genuinely destructive, non-undoable actions: deleting a whole goal
// or trip along with its history.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Native `cancel` fires on Escape / backdrop dismissal; keep our state
      // the source of truth by routing it back through onCancel.
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-xl backdrop:bg-black/50"
    >
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}

      <div className="mt-5 flex gap-2.5">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={destructive ? "destructive" : "default"}
          className="flex-1"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
