/**
 * Strips the internal date-range hint appended to prompts before API calls.
 * The hint is for the AI model only and should not appear in the UI.
 * e.g. "show prices [Default time range: last 12 months — apply unless...]"
 *   → "show prices"
 *
 * @param {string} text
 * @returns {string}
 */
export function stripHint(text) {
  return text.replace(/ \[Default time range:[^\]]*\]/g, '').trim()
}
