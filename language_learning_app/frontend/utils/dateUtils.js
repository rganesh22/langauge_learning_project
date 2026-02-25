/**
 * Date utilities using local time so displayed dates and weekdays match the user's timezone.
 */

/**
 * Get today's date as YYYY-MM-DD in local time.
 * @param {Date} [d] - Optional date; defaults to now.
 * @returns {string}
 */
export function getLocalDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse a date string (YYYY-MM-DD) as local noon to avoid UTC midnight shifting the calendar day.
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  return new Date(dateStr + 'T12:00:00');
}

/**
 * Get short weekday (e.g. Mon, Tue) for a date string in local time.
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string}
 */
export function getShortWeekday(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
}
