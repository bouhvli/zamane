// The app's lit backdrop — a violet key light top-right, a rose fill
// bottom-left, over a fine dot lattice. See ambient.css for the reasoning and
// the values; this component exists only so the shell and the auth screens
// can't drift into two different fields.
//
// Purely decorative: it carries no content and must never be announced.
export function AmbientField() {
  return <div aria-hidden="true" className="ambient-field" />;
}
