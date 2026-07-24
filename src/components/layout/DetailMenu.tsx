import { useEffect, useId, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { MoreVertical } from "lucide-react";

import { cn } from "@/components/ui/utils";

export type DetailMenuItem = {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  destructive?: boolean;
};

// Small overflow ("⋯") menu for a detail page's secondary actions (Edit,
// Delete). Implements the WAI-ARIA menu-button keyboard pattern: opens with
// focus on the first item, Arrow/Home/End move a roving focus between items,
// Escape and outside-click close, and focus returns to the trigger on close
// so keyboard users are never stranded. Rendered inside the page header, which
// is not overflow-clipped, so the absolutely-positioned panel escapes cleanly.
export function DetailMenu({
  items,
  label = "More actions",
  triggerClassName,
}: {
  items: DetailMenuItem[];
  label?: string;
  /** Override the trigger's look — e.g. a frosted-glass variant when the menu
   *  sits over a photo hero rather than a light header. */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  // Move focus onto the first item whenever the menu opens.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function closeAndRestore() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function focusItem(index: number) {
    const count = items.length;
    const next = (index + count) % count;
    itemRefs.current[next]?.focus();
  }

  function onItemKeyDown(event: React.KeyboardEvent, index: number) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusItem(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusItem(0);
        break;
      case "End":
        event.preventDefault();
        focusItem(items.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        closeAndRestore();
        break;
      case "Tab":
        // Leaving the menu by keyboard closes it, without stealing focus back.
        setOpen(false);
        break;
    }
  }

  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
          triggerClassName,
        )}
      >
        <MoreVertical className="size-5" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full z-[var(--z-dropdown)] mt-1 min-w-40 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              tabIndex={index === 0 ? 0 : -1}
              onKeyDown={(event) => onItemKeyDown(event, index)}
              onClick={() => {
                closeAndRestore();
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                item.destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted",
              )}
            >
              {item.icon && <item.icon className="size-4" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
