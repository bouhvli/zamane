/**
 * Shared "frosted row" surface for the Home dashboard's compact cards
 * (goal/trip/shopping) — a translucent glass tint with a soft top sheen,
 * laid over the dashboard's ambient mesh (see .dashboard-mesh in
 * dashboard-mesh.css) so backdrop-blur has real texture to pick up instead
 * of a flat colour. Kept light and restrained in both themes rather than
 * matching the PageHero's drenched brand surface — these are the everyday
 * rows, not the one signature moment.
 *
 * Deliberately only sets background-image/box-shadow/backdrop-filter, not
 * border or background-color — callers keep `border border-border` and any
 * `hover:bg-muted/50` themselves so the existing hover/press treatment on
 * each card still composes normally.
 */
export const GLASS_ROW =
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0.68)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(26,15,20,0.04),0_16px_32px_-18px_rgba(90,39,255,0.16)] backdrop-blur-md dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.03)_100%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.3),0_16px_32px_-18px_rgba(0,0,0,0.55)]";
