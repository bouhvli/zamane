import { FlickerSpinner } from "flicker-dot";
import type { FlickerGrids } from "flicker-dot";

// Ordered 7x7 frames tracing a simple flip-dot pulse. Moved out of the old
// src/assets/loader.js, which wrote bare JSX at module scope with no
// export and was never imported anywhere — this is the same frame data as
// a real, usable component.
const GRIDS: FlickerGrids = [
  [
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false,
  ],
  [
    false, false, false, false, false, false, false, false,
    false, true, false, true, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false,
  ],
  [
    false, false, false, false, false, false, false, false,
    false, true, false, true, false, false, false, true,
    true, true, true, true, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false,
  ],
  [
    false, false, false, false, false, false, false, false,
    false, true, false, true, false, false, false, true,
    true, true, true, true, false, false, true, true,
    true, true, true, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false,
  ],
  [
    false, false, false, false, false, false, false, false,
    false, true, false, true, false, false, false, true,
    true, true, true, true, false, false, true, true,
    true, true, true, false, false, false, true, true,
    true, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false,
  ],
  [
    false, false, false, false, false, false, false, false,
    false, true, false, true, false, false, false, true,
    true, true, true, true, false, false, true, true,
    true, true, true, false, false, false, true, true,
    true, false, false, false, false, false, true, false,
    false, false, false, false, false, false, false, false,
    false,
  ],
  [
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, true, false, false, false, false, false, true,
    true, true, false, false, false, false, false, true,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false,
  ],
  [
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    true, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false,
  ],
  [
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false,
    false,
  ],
];

export function Loader({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <FlickerSpinner
      grids={GRIDS}
      onColor="var(--color-primary)"
      offColor="var(--color-border)"
      size={size}
      className={className}
      title="Loading"
    />
  );
}
