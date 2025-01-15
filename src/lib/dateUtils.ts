import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Converts a date string in format "YYYY-MM-DD HH:mm" to an ISO8601 string
 * in the system's local timezone. Does NOT convert to UTC.
 */
export function toLocalIso8601(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const [ymd, hm] = dateStr.trim().split(" ");
  if (!ymd || !hm) return undefined;

  // Create a date in local timezone
  const utcDate = new Date(`${ymd}T${hm}:00Z`);
  const localDate = toZonedTime(utcDate, TIMEZONE);
  
  // Format with timezone offset
  return formatInTimeZone(localDate, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssxxx");
}

/**
 * Parse an ISO8601 string to a Date object, preserving the timezone
 */
export function parseIso8601(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Format a date to ISO8601 with timezone
 */
export function formatIso8601(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssxxx");
} 