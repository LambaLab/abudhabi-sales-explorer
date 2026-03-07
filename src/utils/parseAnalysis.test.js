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

  it('strips markdown fences before parsing', () => {
    const text = '```json\n{"headline":"Test"}\n```'
    const { parsed } = parseAnalysis(text)
    expect(parsed?.headline).toBe('Test')
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
})
