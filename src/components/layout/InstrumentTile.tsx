import { Link } from "react-router";

import { cn } from "@/components/ui/utils";

/**
 * A dashboard readout: one label, one big figure, one line of context.
 *
 * Home was a stack of same-width, same-weight sections — every element at the
 * same scale, which is a list rather than a dashboard. These tiles sit two-up
 * under the hero and give the page the scale contrast it never had: the hero
 * is the headline, the tiles are the glance, the rows are the detail.
 *
 * Each one answers a question you'd otherwise have to open a tab for: how much
 * is left to buy, how soon is the next trip.
 */
export function InstrumentTile({
  to,
  label,
  value,
  unit,
  caption,
  className,
}: {
  to: string;
  /** Uppercase eyebrow — what this readout measures. */
  label: string;
  /** The figure itself. */
  value: string;
  /** Trailing unit, set smaller so the figure stays the thing you read. */
  unit?: string;
  caption: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "glass-1 glass-tap flex min-h-[92px] flex-col justify-between gap-1 p-3.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
        className,
      )}
    >
      <span className="text-2xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-numeric text-2xl leading-none font-bold text-foreground">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold tracking-normal">{unit}</span>}
      </span>
      <span className="truncate text-xs text-muted-foreground">{caption}</span>
    </Link>
  );
}
