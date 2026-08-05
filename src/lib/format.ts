/** The group's currency, as a short prefix. Exported so input affordances (the
 *  symbol inside an amount field) can't drift from what formatAmount renders —
 *  they did: the contribution field showed "$" while every figure read "MAD". */
export const CURRENCY = "MAD";

export function formatAmount(value: number | string): string {
  const num = typeof value === "string" ? Number(value) : value;
  return CURRENCY + " " + new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(num);
}

/** A name safe to greet someone with. Prefers the display name; otherwise
 *  takes the email local-part and keeps only its first word ("hamza.bouhali"
 *  → "Hamza") so the Home hero — the app's one crown moment — never renders a
 *  raw address fragment at 2rem. */
export function friendlyName(person: { displayName: string | null; email: string }): string {
  const given = person.displayName?.trim();
  if (given) return given;
  const local = person.email.split("@")[0] ?? "";
  const first = local.split(/[._+\-\d]+/).filter(Boolean)[0] ?? local;
  return first ? first[0].toUpperCase() + first.slice(1) : "there";
}

/** First + last initial of a display name, e.g. "Sam Vega" → "SV". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export function formatDate(value: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(undefined, opts ?? { month: "short", day: "numeric", year: "numeric" }).format(date);
}

/** Parse a date-only string ("YYYY-MM-DD" or an ISO datetime) as LOCAL
 *  midnight, so day-granularity labels and comparisons don't drift a day in
 *  either direction across time zones (`new Date("2026-08-01")` is UTC). */
export function parseDay(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Compact human date range for trip cards: drops the year unless it isn't the
 *  current one, and collapses a same-month span. "Aug 1 – 7", "Aug 1 – Sep 3",
 *  "Dec 30 – Jan 2, 2027". A single date (or matching start/end) renders alone. */
export function formatDateRange(startValue: string, endValue?: string | null): string {
  const start = parseDay(startValue);
  const multi = Boolean(endValue && endValue.slice(0, 10) !== startValue.slice(0, 10));
  const end = multi ? parseDay(endValue as string) : start;
  const spansYears = start.getFullYear() !== end.getFullYear();
  const showYear = spansYears || end.getFullYear() !== new Date().getFullYear();
  const md = (d: Date) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);

  if (!multi) return showYear ? `${md(start)}, ${start.getFullYear()}` : md(start);

  const sameMonth = !spansYears && start.getMonth() === end.getMonth();
  const endText = sameMonth ? String(end.getDate()) : md(end);
  return showYear ? `${md(start)} – ${endText}, ${end.getFullYear()}` : `${md(start)} – ${endText}`;
}

/** A contribution's timestamp for the full activity log: today/yesterday, or
 *  a short date once older, always paired with the clock time —
 *  formatRelativeDate alone left every entry from today reading as a bare
 *  "today" with no way to tell which one happened first. */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return `today, ${time}`;
  if (diffDays === 1) return `yesterday, ${time}`;

  const day = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
  return `${day}, ${time}`;
}

export function formatRelativeDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffDays) < 1) return "today";
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, "day");

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, "month");

  return rtf.format(Math.round(diffMonths / 12), "year");
}
