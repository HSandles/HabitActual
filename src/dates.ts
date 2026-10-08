// Calendar dates are stored as local "YYYY-MM-DD" strings. Arithmetic goes through
// UTC day numbers so daylight-saving changes never shift a day.
export type ISODate = string;

const MS_PER_DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

function dayNumber(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

function fromDayNumber(n: number): ISODate {
  const d = new Date(n * MS_PER_DAY);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromDayNumber(dayNumber(iso) + days);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: ISODate, to: ISODate): number {
  return dayNumber(to) - dayNumber(from);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayMon0(iso: ISODate): number {
  return (new Date(dayNumber(iso) * MS_PER_DAY).getUTCDay() + 6) % 7;
}

export function formatDate(iso: ISODate, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}
