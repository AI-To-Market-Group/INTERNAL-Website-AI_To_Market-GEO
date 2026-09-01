import type { BigDate } from "@/types";

const MAX_DAYS_AHEAD = 30;

/**
 * Get next annual occurrence of a date (month/day).
 * Mirrors backend logic in main.py refresh_opportunities_dates.
 */
function getNextAnnualOccurrence(
  baseDateStr: string,
  referenceDate: Date
): Date {
  const [y, m, d] = baseDateStr.split("-").map(Number);
  const baseDate = new Date(y, m - 1, d);
  const now = new Date(referenceDate);
  now.setHours(0, 0, 0, 0);
  const currentYear = now.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();

  // Try this year first
  const thisYearDate = new Date(currentYear, month, day);
  thisYearDate.setHours(0, 0, 0, 0);
  if (thisYearDate >= now) {
    return thisYearDate;
  }

  // If this year's date has passed, use next year
  return new Date(currentYear + 1, month, day);
}

/**
 * Check if a date is in the "active window" (used for API refresh).
 * Mirrors backend logic: dates in window if:
 * - days_until_start <= 30 (date start is within 30 days)
 * - days_until_end >= 0 (period hasn't ended)
 */
export function isDateInActiveWindow(dateItem: BigDate): boolean {
  if (!dateItem.is_active || !dateItem.date_start) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const dateStartStr = dateItem.date_start;
  const dateEndStr = dateItem.date_end;

  const dateStart = getNextAnnualOccurrence(dateStartStr, today);
  let dateEnd: Date;

  if (dateEndStr) {
    dateEnd = getNextAnnualOccurrence(dateEndStr, today);
    // If end date is before start date, crossing year boundary (e.g. Dec 24 - Jan 1)
    if (dateEnd < dateStart) {
      dateEnd = new Date(dateEnd.getFullYear() + 1, dateEnd.getMonth(), dateEnd.getDate());
    }
  } else {
    dateEnd = dateStart;
  }

  dateStart.setHours(0, 0, 0, 0);
  dateEnd.setHours(0, 0, 0, 0);

  const daysUntilStart = Math.ceil((dateStart.getTime() - todayTime) / (24 * 60 * 60 * 1000));
  const daysUntilEnd = Math.ceil((dateEnd.getTime() - todayTime) / (24 * 60 * 60 * 1000));

  // Exclude if: date_start too far (> 30j) OR date_end already passed
  if (daysUntilStart > MAX_DAYS_AHEAD) return false;
  if (daysUntilEnd < 0) return false;

  return true;
}
