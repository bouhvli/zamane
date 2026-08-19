import { useState } from "react";
import type React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/components/ui/utils";

// The leading square on every compact dashboard row — goals, trips, shopping.
// One component so all three read as the same kind of object (consistency), and
// so the "photo, or branded gradient when there isn't one" logic lives in one
// place instead of being re-derived per card.
//
// The violet gradient is ALWAYS painted first, so the square is never an empty
// hole while a photo loads or after one fails; the photo then covers it.
export function CardThumb({
  src,
  icon: Icon,
  dim,
  className,
  style,
}: {
  /** Cover photo, if the entity has one. */
  src?: string | null;
  /** Shown over the gradient when there's no photo. */
  icon: LucideIcon;
  /** Desaturate slightly — used for past trips and reached goals. */
  dim?: boolean;
  className?: string;
  /** Carries the view-transition-name that pairs this thumbnail with the
   *  detail page's cover, so the photo grows into place on navigation. */
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn(
        // radius-sm against the row's radius-md: nested radius derived from the
        // ramp (inner = outer - padding), not a hand-picked 14px.
        "brand-thumb-base relative size-16 shrink-0 overflow-hidden rounded-sm",
        className,
      )}
    >
      <div className="brand-thumb-radial absolute inset-0" />

      {showImage ? (
        <img
          src={src as string}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn("absolute inset-0 h-full w-full object-cover", dim && "saturate-[0.65]")}
        />
      ) : (
        <Icon className="absolute inset-0 m-auto size-6 text-[var(--thumb-ink)] opacity-45" />
      )}
    </div>
  );
}
