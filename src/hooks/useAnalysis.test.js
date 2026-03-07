import { describe, it, expect } from 'vitest'
import { parseAnalysis } from '../utils/parseAnalysis'
import { _extractShortText } from './useAnalysis'

describe('no-data detection', () => {
  it('sets noData: true when explain returns JSON with suggestions', async () => {
    const suggestionsJson = JSON.stringify({
      headline: 'No comparison data available',
      analysis: 'No records found.',
      suggestions: [
        { label: 'Ready trend', query: 'Ready price trend 2021-2025', reason: 'Has data' },
        { label: 'Off-plan volume', query: 'Off-plan volume by district', reason: 'Has data' },
      ],
    })
    const { parsed, suggestions } = parseAnalysis(suggestionsJson)
    expect(suggestions).toHaveLength(2)
    expect(suggestions[0].label).toBe('Ready trend')
    expect(parsed?.headline).toBe('No comparison data available')
    const noData = !!(suggestions?.length > 0)
    expect(noData).toBe(true)
  })

  it('sets noData: false when explain returns plain text', async () => {
    const { suggestions } = parseAnalysis('Prices rose 18% in the last 12 months.')
    const noData = !!(suggestions?.length > 0)
    expect(noData).toBe(false)
  })
})

describe('_extractShortText', () => {
  it('extracts headline when model returns JSON with headline field', () => {
    expect(_extractShortText('{"headline":"Prices rose 12%.","analysis":"steady growth"}')).toBe('Prices rose 12%.')
  })

  it('prefers one_liner over headline when both present', () => {
    expect(_extractShortText('{"one_liner":"Short answer.","headline":"Long answer."}')).toBe('Short answer.')
  })

  it('returns plain text unchanged', () => {
    expect(_extractShortText('Prices rose 12% in Q1.')).toBe('Prices rose 12% in Q1.')
  })

  it('strips markdown code fences from plain text', () => {
    expect(_extractShortText('```json\n{"headline":"test"}\n```')).toBe('test')
  })

  it('returns empty string for unknown-field JSON (no known readable field)', () => {
    expect(_extractShortText('{"unknown_field":"something"}')).toBe('')
  })

  it('returns raw input unchanged when input is falsy (null)', () => {
    expect(_extractShortText(null)).toBeNull()
  })
})
