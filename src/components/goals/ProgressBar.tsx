export { ProgressTrack as ProgressBar } from "@/components/ProgressOrbit";

// The bar's gradient, track colour and transition moved into the orbit system
// (see ProgressOrbit.tsx and orbit.css) so the ring and the bar can't drift
// apart on colour — they are the same instrument in two shapes. This file
// stays as the name every call site already imports.
