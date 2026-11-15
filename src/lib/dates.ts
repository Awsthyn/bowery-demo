/**
 * Dates of birth are calendar days, not instants. They are stored as `yyyy-mm-dd` and converted using
 * *local* date parts, so a picker value never shifts by a day because of the device time zone.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local-midnight Date for a `yyyy-mm-dd` string, or null if it is not a real calendar day. */
export function fromIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** The latest birth date that is still `years` old today. */
export function yearsAgo(years: number, today = new Date()): Date {
  return new Date(today.getFullYear() - years, today.getMonth(), today.getDate());
}

export function formatDisplayDate(value: string): string {
  const date = fromIsoDate(value);
  return date ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
}
