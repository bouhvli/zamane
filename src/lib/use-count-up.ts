import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Counts a figure up from zero once, on arrival.
 *
 * Used for exactly one number in the app: the shared savings total on Home.
 * That figure is the product's emotional peak (Peak-End / Goal-Gradient), and
 * a number that arrives is read; a number that is simply present is skimmed.
 *
 * Deliberately narrow:
 *  - it runs once per mount, so a partner's contribution landing in the
 *    background (which revalidates the loader) updates the figure without
 *    replaying the animation;
 *  - it snaps straight to the target when the OS asks for reduced motion, or
 *    when there is no target to travel to;
 *  - it drives state, not the DOM, so the value stays in the React tree and a
 *    screen reader is never handed a number mid-count.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(target);
  // The animation is a one-time arrival effect. Without this, every
  // revalidation would restart the count from zero.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) {
      setValue(target);
      return;
    }
    hasRun.current = true;

    if (target <= 0 || window.matchMedia?.(REDUCED_MOTION).matches) {
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    // Same deceleration as --ease-glide: fast off the line, settling into the
    // final digits rather than crawling through them.
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * ease(progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    setValue(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
