import { describe, it, expect } from 'vitest'
import { parseAnalysis } from './parseAnalysis'

describe('parseAnalysis', () => {
  it('returns {parsed: null, suggestions: null} for empty/null text', () => {
    expect(parseAnalysis(null)).toEqual({ parsed: null, suggestions: null })
    expect(parseAnalysis('')).toEqual({ parsed: null, suggestions: null })
  })

  it('parses plain JSON object', () => {
    const text = JSON.stringify({ headline: 'Test', analysis: 'Good.' })
    const { parsed, suggestions } = parseAnalysis(text)
    expect(parsed?.headline).toBe('Test')
    expect(suggestions).toBeNull()
  })

  it('strips markdown fences before parsing (```json tag)', () => {
    const text = '```json\n{"headline":"Test"}\n```'
    const { parsed } = parseAnalysis(text)
    expect(parsed?.headline).toBe('Test')
  })

  // TEST-1: bare fence and uppercase language tag variants
  it('strips bare markdown fence (``` with no language tag)', () => {
    const text = '```\n{"headline":"Bare"}\n```'
    const { parsed } = parseAnalysis(text)
    expect(parsed?.headline).toBe('Bare')
  })

  it('strips markdown fence with uppercase language tag (```JSON)', () => {
    const text = '```JSON\n{"headline":"Uppercase"}\n```'
    const { parsed } = parseAnalysis(text)
    expect(parsed?.headline).toBe('Uppercase')
  })

  it('strips markdown fence with javascript language tag (```javascript)', () => {
    const text = '```javascript\n{"headline":"JS tag"}\n```'
    const { parsed } = parseAnalysis(text)
    expect(parsed?.headline).toBe('JS tag')
  })

  it('extracts first {...} substring to handle preamble text', () => {
    const text = 'Here is the analysis: {"headline":"Test","analysis":"Good."}'
    const { parsed } = parseAnalysis(text)
    expect(parsed?.headline).toBe('Test')
  })

  it('extracts suggestions array when present', () => {
    const json = JSON.stringify({
      headline: 'No data found',
      suggestions: [
        { label: 'Ready trend', query: 'Ready price trend 2021-2025', reason: 'Has data' },
        { label: 'Off-plan volume', query: 'Off-plan volume by district', reason: 'Has data' },
      ],
    })
    const { parsed, suggestions } = parseAnalysis(json)
    expect(parsed?.headline).toBe('No data found')
    expect(suggestions).toHaveLength(2)
    expect(suggestions[0].label).toBe('Ready trend')
    expect(suggestions[0].query).toBe('Ready price trend 2021-2025')
  })

  it('returns suggestions: null when suggestions array is absent', () => {
    const json = JSON.stringify({ headline: 'Test', analysis: 'Fine.' })
    const { suggestions } = parseAnalysis(json)
    expect(suggestions).toBeNull()
  })

  it('returns suggestions: null when suggestions is empty array', () => {
    const json = JSON.stringify({ headline: 'Test', suggestions: [] })
    const { suggestions } = parseAnalysis(json)
    expect(suggestions).toBeNull()
  })

  it('returns {parsed: null, suggestions: null} for non-JSON text', () => {
    const { parsed, suggestions } = parseAnalysis('Prices rose 18% last year.')
    expect(parsed).toBeNull()
    expect(suggestions).toBeNull()
  })

  it('handles JSON with trailing postamble text', () => {
    const text = '{"headline":"Test","analysis":"Good."}\n\nNote: all figures in AED.'
    const { parsed } = parseAnalysis(text)
    expect(parsed?.headline).toBe('Test')
  })

  // TEST-2: known limitation — postamble containing braces confuses lastIndexOf
  it('known limitation: postamble with braces causes parse failure', () => {
    // The postamble "see {below}" contains a '}' that lastIndexOf finds instead
    // of the actual closing brace of the JSON object, so JSON.parse throws and
    // the function returns the null-null sentinel.
    const text = '{"headline":"Test"} see {below}'
    const { parsed, suggestions } = parseAnalysis(text)
    expect(parsed).toBeNull()
    expect(suggestions).toBeNull()
  })

  // TEST-3: array-root rejection
  it('returns {parsed: null, suggestions: null} for a JSON array at root', () => {
    const { parsed, suggestions } = parseAnalysis('["a","b"]')
    expect(parsed).toBeNull()
    expect(suggestions).toBeNull()
  })

  // TEST-4: malformed suggestion items pass through as-is (no schema validation)
  it('passes through suggestion items with missing fields without validation', () => {
    const json = JSON.stringify({
      headline: 'Test',
      suggestions: [
        { label: 'foo' }, // missing query and reason fields
      ],
    })
    const { parsed, suggestions } = parseAnalysis(json)
    expect(parsed?.headline).toBe('Test')
    // The parser does not validate item schema — partial items are returned as-is
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toEqual({ label: 'foo' })
  })
})
