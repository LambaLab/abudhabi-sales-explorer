/**
 * Derive up-to-2-letter uppercase initials from a full name.
 * Returns '' for empty/null input.
 */
export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}
