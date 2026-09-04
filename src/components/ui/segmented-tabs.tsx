import { useRef } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "./utils";

export type SegmentedTab<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Rendered as a small count beside the label — the number of things behind
   *  the tab, so switching to it is an informed choice rather than a probe. */
  badge?: number;
};

/**
 * A segmented control: one visible group, one selection, no hidden menu.
 *
 * Implemented on the WAI-ARIA tabs pattern (roving tabindex, arrow keys, Home
 * and End) rather than three styled buttons, so a keyboard reaches the whole
 * group with one Tab stop and a screen reader announces "2 of 3" instead of
 * three unrelated controls.
 *
 * The indicator is a single element sliding on `transform`, not a border
 * hopping between children — the movement is continuous, composited, and shows
 * which direction the selection travelled.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group, e.g. "Trip sections". */
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, tabs.findIndex((t) => t.value === value));

  function focusTab(next: number) {
    const clamped = (next + tabs.length) % tabs.length;
    onChange(tabs[clamped].value);
    refs.current[clamped]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("seg glass-3 rounded-full", className)}
      style={{ ["--seg-count" as string]: tabs.length, ["--seg-index" as string]: index }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          focusTab(index + 1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          focusTab(index - 1);
        } else if (event.key === "Home") {
          event.preventDefault();
          focusTab(0);
        } else if (event.key === "End") {
          event.preventDefault();
          focusTab(tabs.length - 1);
        }
      }}
    >
      <span aria-hidden="true" className="seg-thumb" />

      {tabs.map((tab, i) => {
        const selected = tab.value === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`seg-tab-${tab.value}`}
            aria-selected={selected}
            aria-controls={`seg-panel-${tab.value}`}
            // Roving tabindex: only the selected tab is in the tab order, so
            // Tab moves past the whole group and the arrows move within it.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex min-h-10 items-center justify-center gap-1.5 rounded-full px-2 text-sm outline-none",
              "transition-colors duration-[var(--dur-2)] ease-[var(--ease-glide)]",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50",
              selected ? "font-semibold text-foreground" : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon aria-hidden="true" className={cn("size-4 shrink-0", selected && "text-primary")} />}
            <span className="truncate">{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  "font-numeric text-xs tabular-nums transition-colors duration-[var(--dur-2)]",
                  selected ? "text-primary" : "text-muted-foreground",
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The panel a SegmentedTabs selection reveals. Keyed by the active value at
 *  the call site so React remounts it and the slide-in replays on every swap. */
export function SegmentedPanel({
  value,
  /** -1 when the new tab sits to the left of the old one, so the panel enters
   *  from the side it conceptually came from. */
  direction = 1,
  children,
  className,
}: {
  value: string;
  direction?: 1 | -1;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`seg-panel-${value}`}
      aria-labelledby={`seg-tab-${value}`}
      tabIndex={-1}
      className={cn("seg-panel outline-none", className)}
      style={{ ["--seg-from" as string]: `${direction * 10}px` }}
    >
      {children}
    </div>
  );
}
