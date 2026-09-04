import { cn } from "./utils";

/**
 * The app's confirmation gesture, in one component.
 *
 * The checkmark is an SVG path that DRAWS on check rather than a glyph that
 * appears (see `.tick-path` in trip-plan.css). It's the most-repeated
 * acknowledgement in the organizer — every stop on the timeline, every line on
 * the prep list — and 180ms of stroke is the difference between a tap that
 * registered and one that flickered.
 *
 * A real `<button role="checkbox">` rather than a styled div: it comes with
 * Space activation, a focus ring, and an announced checked state for free.
 */
export function TickBox({
  checked,
  onChange,
  label,
  pending,
  className,
  size = "md",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The accessible name, e.g. "Mark Dinner at Maaemo as done". */
  label: string;
  /** True while the write is in flight — the box stays in its optimistic state
   *  and only blocks a second tap. */
  pending?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "size-5" : "size-6";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={pending}
      data-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        // The hit area is padded out to the 44px mobile floor while the drawn
        // box stays visually small — a 24px tap target on a moving train is a
        // miss, and growing the box to fit would dominate the row.
        "group -m-2.5 flex size-11 shrink-0 items-center justify-center rounded-full outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-progress",
        className,
      )}
    >
      <span
        className={cn(
          box,
          "flex items-center justify-center rounded-full border-2",
          "transition-[background-color,border-color,transform] duration-[var(--dur-2)] ease-[var(--ease-glide)]",
          "group-active:scale-90",
          checked
            ? "border-success bg-success text-white"
            // --border is a 15%-alpha rose hairline: right for a card edge, far
          // too faint for the one control on the row you're meant to hit.
          : "border-muted-foreground/45 bg-card/60 text-transparent group-hover:border-primary/60",
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden="true">
          <path
            className="tick-path"
            d="M4 12.5 9.5 18 20 6.5"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}
