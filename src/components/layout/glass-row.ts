/**
 * The compact-row surface: level 1 of the glass ramp, plus the tap treatment.
 *
 * This used to be a ~600-character Tailwind string hand-mixing a gradient, two
 * shadows and a blur — one of the four separate depth recipes in the app. It
 * is now two classes from glass.css, so a row, a card and the nav pill are
 * demonstrably the same material at different depths rather than three things
 * that happen to look similar.
 *
 * `glass-tap` brings the hover tint, the violet edge and the press scale, so
 * call sites no longer repeat them. Callers still own their own radius when
 * they want something other than the level's default (--radius-md).
 */
export const GLASS_ROW = "glass-1 glass-tap";
