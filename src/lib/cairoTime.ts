/**
 * Cairo Time Zone Utilities (Africa/Cairo)
 * Canonical handling of church liturgical day boundaries, prayer streaks, and calendar dates.
 * Prevents UTC-drift errors at local midnight.
 */

export const CAIRO_TIMEZONE = 'Africa/Cairo';

/**
 * Formats a given timestamp or current time into Cairo local Date components
 */
export function getCairoDateParts(inputDate: Date | string | number = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateString: string; // YYYY-MM-DD in Cairo
  timeString: string; // HH:MM:SS in Cairo
} {
  const d = typeof inputDate === 'string' || typeof inputDate === 'number' ? new Date(inputDate) : inputDate;
  const safeDate = isNaN(d.getTime()) ? new Date() : d;

  // Use Intl.DateTimeFormat with Africa/Cairo timeZone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CAIRO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(safeDate);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      partMap[p.type] = p.value;
    }
  }

  const year = parseInt(partMap.year || '2026', 10);
  const month = parseInt(partMap.month || '1', 10);
  const day = parseInt(partMap.day || '1', 10);
  const hour = parseInt(partMap.hour || '0', 10);
  const minute = parseInt(partMap.minute || '0', 10);
  const second = parseInt(partMap.second || '0', 10);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const dateString = `${year}-${pad(month)}-${pad(day)}`;
  const timeString = `${pad(hour)}:${pad(minute)}:${pad(second)}`;

  return { year, month, day, hour, minute, second, dateString, timeString };
}

/**
 * Returns today's canonical Cairo calendar date in "YYYY-MM-DD" format
 */
export function getCairoDateString(inputDate: Date | string | number = new Date()): string {
  return getCairoDateParts(inputDate).dateString;
}

/**
 * Check if two dates fall on the same Cairo calendar day
 */
export function isSameCairoDay(dateA: Date | string | number, dateB: Date | string | number): boolean {
  return getCairoDateString(dateA) === getCairoDateString(dateB);
}

/**
 * Checks if laterDate is exactly the consecutive next calendar day after earlierDate in Cairo
 */
export function isConsecutiveCairoDay(earlierDate: Date | string, laterDate: Date | string): boolean {
  const earlierParts = getCairoDateParts(earlierDate);
  const laterParts = getCairoDateParts(laterDate);

  const date1 = new Date(earlierParts.year, earlierParts.month - 1, earlierParts.day);
  const date2 = new Date(laterParts.year, laterParts.month - 1, laterParts.day);

  const diffMs = date2.getTime() - date1.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

/**
 * Authoritative streak calculation evaluated using Cairo local days
 */
export function calculateCairoStreak(historyDateStrings: string[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (!historyDateStrings || historyDateStrings.length === 0) {
    return { currentStreak: 1, longestStreak: 1 };
  }

  // Deduplicate and sort descending by Cairo calendar date string
  const uniqueCairoDays = Array.from(
    new Set(historyDateStrings.map(d => getCairoDateString(d)))
  ).sort().reverse();

  if (uniqueCairoDays.length === 0) {
    return { currentStreak: 1, longestStreak: 1 };
  }

  const todayCairo = getCairoDateString();
  const yesterdayParts = getCairoDateParts();
  const yesterdayObj = new Date(yesterdayParts.year, yesterdayParts.month - 1, yesterdayParts.day - 1);
  const yesterdayCairo = getCairoDateString(yesterdayObj);

  const mostRecent = uniqueCairoDays[0];
  const isActive = mostRecent === todayCairo || mostRecent === yesterdayCairo;

  let currentStreak = 0;
  if (isActive) {
    currentStreak = 1;
    for (let i = 0; i < uniqueCairoDays.length - 1; i++) {
      if (isConsecutiveCairoDay(uniqueCairoDays[i + 1], uniqueCairoDays[i])) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak across entire history
  let longestStreak = currentStreak;
  let tempStreak = 1;
  const ascendingDays = [...uniqueCairoDays].reverse();
  for (let i = 0; i < ascendingDays.length - 1; i++) {
    if (isConsecutiveCairoDay(ascendingDays[i], ascendingDays[i + 1])) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 1;
    }
  }

  return {
    currentStreak: Math.max(1, currentStreak),
    longestStreak: Math.max(1, longestStreak)
  };
}
