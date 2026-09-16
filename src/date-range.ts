export interface DateRange {
  from: number;
  to: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class DateRangeError extends Error {
  override readonly name = "DateRangeError";
}

export function validateDate(date: string): void {
  const match = DATE_PATTERN.exec(date);
  if (match === null) {
    throw new DateRangeError(
      "Invalid date. Use a real calendar date in YYYY-MM-DD format.",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new DateRangeError(
      "Invalid date. Use a real calendar date in YYYY-MM-DD format.",
    );
  }
}

export function validateTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new DateRangeError(
      "Invalid timezone. Use an IANA timezone such as Etc/UTC or America/Los_Angeles.",
    );
  }
}

export function dateRange(date: string, timezone: string): DateRange {
  validateDate(date);
  validateTimezone(timezone);

  const from = zonedStartOfDay(date, timezone);
  const nextDate = addUtcDays(date, 1);
  const to = zonedStartOfDay(nextDate, timezone);
  if (to <= from) {
    throw new DateRangeError(
      `Could not determine a valid day boundary for ${date} in ${timezone}.`,
    );
  }
  return { from, to };
}

function addUtcDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return [
    result.getUTCFullYear().toString().padStart(4, "0"),
    (result.getUTCMonth() + 1).toString().padStart(2, "0"),
    result.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

function zonedStartOfDay(date: string, timezone: string): number {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const target = Date.UTC(year, month - 1, day);
  let instant = target;

  // Resolve the timezone's UTC offset at the target local midnight. Repeating
  // handles an offset transition between the initial UTC guess and midnight.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(instant, timezone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const correction = target - represented;
    instant += correction;
    if (correction === 0) break;
  }

  const resolved = zonedParts(instant, timezone);
  if (
    resolved.year !== year ||
    resolved.month !== month ||
    resolved.day !== day ||
    resolved.hour !== 0 ||
    resolved.minute !== 0 ||
    resolved.second !== 0
  ) {
    throw new DateRangeError(
      `Timezone ${timezone} does not have a resolvable midnight for ${date}.`,
    );
  }
  return instant;
}

function zonedParts(instant: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}
