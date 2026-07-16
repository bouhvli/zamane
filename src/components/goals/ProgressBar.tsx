import { cn } from "@/components/ui/utils";

export function ProgressBar({
  percent,
  className,
  label,
}: {
  percent: number;
  className?: string;
  /** Accessible name so a screen reader announces "<goal> 42%", not a bare "42%". */
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ? `${label} progress` : "Progress"}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        // One pink family: fill runs from the brand violet to the brand rose
        // (--accent), instead of the old hot-magenta nav gradient that
        // introduced a second, unrelated pink. motion-reduce snaps instead of
        // sweeping for users who ask for less motion.
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--accent))] transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
