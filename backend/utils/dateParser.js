// backend/utils/dateParser.js

/**
 * Smart date parser that ALWAYS picks the nearest FUTURE date
 * Examples (if today is Dec 3, 2025):
 *   "December 5th"     → Dec 5, 2025
 *   "January 10th"     → Jan 10, 2026
 *   "5th December"     → Dec 5, 2025
 *   "tomorrow"         → Dec 4, 2025
 *   "today"            → Dec 3, 2025 (if booking allows same-day)
 */
function parseNaturalDate(input) {
  if (!input) return null;

  const str = String(input).trim();
  const lower = str.toLowerCase();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // midnight today

  // Handle today / tomorrow
  if (lower === 'today') return today;
  if (lower === 'tomorrow') {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return t;
  }

  // Remove ordinals: 1st → 1, 23rd → 23, etc.
  const cleaned = str.replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1').trim();

  const currentYear = now.getFullYear();
  const nextYear = currentYear + 1;

  // Try parsing with current year first
  let date = new Date(`${cleaned} ${currentYear}`);

  // If the resulting date is in the past → try next year
  if (date < today) {
    date = new Date(`${cleaned} ${nextYear}`);
  }

  // Final fallback with comma format
  if (isNaN(date.getTime()) || date < today) {
    date = new Date(`${cleaned}, ${nextYear}`);
  }

  // If still invalid
  if (isNaN(date.getTime())) {
    console.warn('Date parsing failed for:', str);
    return null;
  }

  // Normalize to midnight
  date.setHours(0, 0, 0, 0);
  return date;
}

module.exports = parseNaturalDate;