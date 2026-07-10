export function formatAmount(value: number | string): string {
  const num = typeof value === "string" ? Number(value) : value;
  return "$" + new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(num);
}

export function formatDate(value: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(undefined, opts ?? { month: "short", day: "numeric", year: "numeric" }).format(date);
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
