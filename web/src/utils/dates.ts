import dayjs, { type Dayjs } from "dayjs";

/** Parse YYYY-MM-DD or ISO date-only values without timezone shift. */
export function parseCalendarDate(value: string): Dayjs {
  const key = value.includes("T") ? value.slice(0, 10) : value;
  return dayjs(key, "YYYY-MM-DD");
}

export function formatCalendarDate(value: string, format = "DD MMM YYYY"): string {
  return parseCalendarDate(value).format(format);
}
