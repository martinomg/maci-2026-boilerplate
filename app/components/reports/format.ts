/** Display formatting shared by the report tiles, tables and charts. */

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });

const dayShort = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const dayLong = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const hourShort = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** All report buckets are UTC days; day keys are `YYYY-MM-DD`. */
function fromDayKey(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function formatMoney(amount: number): string {
  return clp.format(Math.round(amount));
}

export function formatCount(value: number): string {
  return integer.format(value);
}

export function formatPercent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export function formatDay(day: string): string {
  return dayShort.format(fromDayKey(day));
}

export function formatDayLong(day: string): string {
  return dayLong.format(fromDayKey(day));
}

export function formatTimestamp(iso: string | number | Date): string {
  const date = new Date(iso);
  return `${dayShort.format(date)} ${hourShort.format(date)} UTC`;
}

export function formatHour(iso: string | number | Date): string {
  return hourShort.format(new Date(iso));
}

export function formatRangeLabel(from: string, to: string): string {
  return `${formatDayLong(from)} – ${formatDayLong(to)} (UTC)`;
}
