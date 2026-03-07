/**
 * Robust extraction of the first {…} JSON object from LLM text.
 *
 * Handles:
 * - Markdown fences: ```json … ```
 * - Preamble/postamble text (extracts first { … } substring)
 * - Trailing notes after the closing brace
 *
 * Returns { parsed, suggestions } where:
 * - parsed: the full parsed object, or null if not valid JSON
 * - suggestions: array from parsed.suggestions, or null if absent/empty
 */
export function parseAnalysis(text) {
  if (!text) return { parsed: null, suggestions: null }

  // Strip markdown code fences if present
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  // Find first { … } substring to tolerate preamble/postamble text
  const jsonStart = stripped.indexOf('{')
  const jsonEnd   = stripped.lastIndexOf('}')

  if (jsonStart === -1 || jsonEnd <= jsonStart) {
    return { parsed: null, suggestions: null }
  }

  try {
    const obj = JSON.parse(stripped.slice(jsonStart, jsonEnd + 1))
    if (typeof obj !== 'object' || Array.isArray(obj)) {
      return { parsed: null, suggestions: null }
    }

    const suggestions =
      Array.isArray(obj.suggestions) && obj.suggestions.length > 0
        ? obj.suggestions
        : null

    return { parsed: obj, suggestions }
  } catch {
    return { parsed: null, suggestions: null }
  }
}
