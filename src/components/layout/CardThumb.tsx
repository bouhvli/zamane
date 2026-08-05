import { useState } from "react";
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
}: {
  /** Cover photo, if the entity has one. */
  src?: string | null;
  /** Shown over the gradient when there's no photo. */
  icon: LucideIcon;
  /** Desaturate slightly — used for past trips and reached goals. */
  dim?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "brand-thumb-base relative size-16 shrink-0 overflow-hidden rounded-[14px]",
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
        <Icon className="absolute inset-0 m-auto size-6 text-white/45" strokeWidth={1.75} />
      )}
    </div>
  );
}
