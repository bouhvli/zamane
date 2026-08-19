import { createElement } from "react";
import type { CSSProperties, ReactElement } from "react";

import { cn } from "@/components/ui/utils";

/**
 * Renders a Hugeicons glyph as a **twotone** mark: the shape that carries the
 * meaning at full strength, the shapes that merely enclose or decorate it at
 * reduced opacity.
 *
 * Why this exists rather than an import from Hugeicons' twotone set: twotone
 * is a Hugeicons **Pro** style. The public package (`@hugeicons/core-free-icons`)
 * ships stroke-rounded only — 5,448 glyphs, every one a plain array of SVG
 * nodes. That array is the whole icon, so a twotone reading is a matter of
 * deciding which nodes are primary; this component does exactly that, on
 * Hugeicons' own artwork. If a Pro licence lands, swapping to
 * `@hugeicons-pro/core-twotone-rounded` is a change of import and the
 * `primary` arrays go away.
 *
 * `primary` is per-icon because the meaningful node is not always the first:
 * on a map glyph it's the pin (the globe behind it is the container), on a
 * target it's the centre (the rings are), on a house it's the outline (the
 * door is the detail).
 */
type IconNodes = readonly (readonly [string, { readonly [key: string]: string | number }])[];

export function TwotoneIcon({
  icon,
  primary = [0],
  size = 20,
  secondaryOpacity = 0.42,
  strokeWidth,
  className,
  style,
}: {
  /** A glyph from `@hugeicons/core-free-icons`. */
  icon: IconNodes;
  /** Indices of the nodes that stay at full strength. */
  primary?: readonly number[];
  size?: number;
  /** How far back the secondary nodes sit. */
  secondaryOpacity?: number;
  /** Hugeicons draws at 1.5; the app's own icon default is 1.75. */
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}): ReactElement {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      className={cn("shrink-0", className)}
      style={style}
    >
      {icon.map(([tag, attrs], index) =>
        createElement(tag, {
          ...attrs,
          key: index,
          // Every node inherits the parent's colour, so the two tones are one
          // hue at two strengths — which is what keeps a twotone icon reading
          // as a single mark rather than two overlapping ones.
          stroke: "currentColor",
          ...(strokeWidth === undefined ? null : { strokeWidth }),
          opacity: primary.includes(index) ? 1 : secondaryOpacity,
        }),
      )}
    </svg>
  );
}
