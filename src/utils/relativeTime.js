/**
 * Returns a human-readable relative time string from a timestamp.
 * @param {number} ts - epoch milliseconds
 * @returns {string} e.g. 'just now', '3m ago', '2h ago'
 */
export function relativeTime(ts) {
  const diff = Date.now() - ts
  if (diff < 60_000)    return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}
