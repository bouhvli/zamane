import { cn } from "@/components/ui/utils";

/**
 * A loading placeholder shaped like the thing it becomes.
 *
 * The app had one of these, inline in HomePage, sized to a compact row. Every
 * other route showed either nothing or a centred spinner, which tells the user
 * that something is happening but not *what is coming* — a skeleton does both,
 * and keeps the layout from jumping when the data lands (Doherty: the wait
 * should feel like progress, not a gap).
 *
 * The shimmer travels along the ambient field's own light direction, so a
 * loading surface is lit by the same lamp as the real one it turns into.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton rounded-sm", className)} />;
}

/** A compact list row: 64px thumb + 2 × 12px padding = 88px, so resolving
 *  doesn't shift the page. */
export function SkeletonRow({ count = 1 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[88px] rounded-md" />
      ))}
    </div>
  );
}

/**
 * The shape of Home, used as the app's boot screen. Standing in for the real
 * first screen — rather than a spinner — means the layout is already settled
 * when the data arrives, and the wait reads as the app opening instead of the
 * app stalling.
 */
export function HomeSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mx-auto max-w-md px-4 pt-4 pb-5">
        <Skeleton className="h-[230px] rounded-lg" />
      </div>
      <div className="mx-auto max-w-md space-y-6 px-4">
        <div className="grid grid-cols-2 gap-2.5">
          <Skeleton className="h-[92px] rounded-md" />
          <Skeleton className="h-[92px] rounded-md" />
        </div>
        {[0, 1, 2].map((section) => (
          <div key={section} className="space-y-2">
            <div className="mb-2 flex items-center gap-2">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-xs" />
            </div>
            <Skeleton className="h-[88px] rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The shape of a tab: header, then a stack of cards.
 *
 * Every list route needs one now. Loaders stopped awaiting their data (see
 * route-cache.ts) so a tab switch commits in one frame whether or not the
 * payload is in hand — which means the page itself is what stands in for the
 * gap, instead of the previous screen sitting frozen while the router waited.
 *
 * `cardHeight` is the real card's height so nothing shifts when the data lands.
 */
export function PageSkeleton({
  cards = 3,
  cardHeight = "h-[218px]",
  stats = 3,
}: {
  cards?: number;
  cardHeight?: string;
  stats?: number;
}) {
  return (
    <div aria-hidden="true">
      {/* Mirrors PageHeader: px-4 pt-5 pb-2, a 2xl title, then the stats row. */}
      <div className="mx-auto max-w-md px-4 pt-5 pb-2">
        <Skeleton className="h-8 w-36 rounded-xs" />
        <Skeleton className="mt-2 h-4 w-56 rounded-xs" />
        {stats > 0 && (
          <div className="mt-3 flex gap-4">
            {Array.from({ length: stats }, (_, i) => (
              <Skeleton key={i} className="h-4 w-20 rounded-xs" />
            ))}
          </div>
        )}
      </div>
      <div className="mx-auto max-w-md space-y-4 px-4 pb-12">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className={cn("rounded-lg", cardHeight)} />
        ))}
      </div>
    </div>
  );
}

/**
 * The shape of a detail page: back link, title, a cover or instrument, then the
 * feed below it. Same reason as PageSkeleton — a detail route commits before
 * its payload arrives, so the page has to stand in for the gap itself.
 */
export function DetailSkeleton({ cover = true, rows = 3 }: { cover?: boolean; rows?: number }) {
  return (
    <div aria-hidden="true">
      <div className="mx-auto max-w-md px-4 pt-5 pb-2">
        <Skeleton className="h-5 w-20 rounded-xs" />
        <Skeleton className="mt-3 h-8 w-52 rounded-xs" />
      </div>
      <div className="mx-auto max-w-md space-y-4 px-4 pb-12">
        {cover && <Skeleton className="h-[200px] rounded-lg" />}
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-[96px] rounded-md" />
        ))}
      </div>
    </div>
  );
}
