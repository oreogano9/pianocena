export const SUPPORTED_YEARS = [2026, 2027] as const;

export const SUPPORTED_MONTHS = SUPPORTED_YEARS.flatMap((year) =>
  Array.from({ length: 12 }, (_, monthIndex) => ({
    key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    year,
    monthIndex,
  })),
);

const SUPPORTED_MONTH_KEYS = new Set(SUPPORTED_MONTHS.map((month) => month.key));

export function isSupportedMonthKey(value: string | null): value is string {
  return typeof value === "string" && SUPPORTED_MONTH_KEYS.has(value);
}

export function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, monthIndex: month - 1 };
}

export function daysInMonth(monthKey: string) {
  const { year, monthIndex } = parseMonthKey(monthKey);
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function firstDayOffset(monthKey: string) {
  const { year, monthIndex } = parseMonthKey(monthKey);
  return (new Date(year, monthIndex, 1).getDay() + 6) % 7;
}

export function currentSupportedMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const candidate = `${year}-${month}`;

  if (SUPPORTED_MONTH_KEYS.has(candidate)) return candidate;
  return candidate < SUPPORTED_MONTHS[0].key
    ? SUPPORTED_MONTHS[0].key
    : SUPPORTED_MONTHS[SUPPORTED_MONTHS.length - 1].key;
}
