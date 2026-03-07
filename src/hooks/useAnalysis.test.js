import { describe, it, expect } from 'vitest'
import { parseAnalysis } from '../utils/parseAnalysis'

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
    const { parseAnalysis } = await import('../utils/parseAnalysis')
    const { parsed, suggestions } = parseAnalysis(suggestionsJson)
    expect(suggestions).toHaveLength(2)
    expect(suggestions[0].label).toBe('Ready trend')
    expect(parsed?.headline).toBe('No comparison data available')
    const noData = !!(suggestions?.length > 0)
    expect(noData).toBe(true)
  })

  it('sets noData: false when explain returns plain text', async () => {
    const { parseAnalysis } = await import('../utils/parseAnalysis')
    const { suggestions } = parseAnalysis('Prices rose 18% in the last 12 months.')
    const noData = !!(suggestions?.length > 0)
    expect(noData).toBe(false)
  })
})

describe('extractShortText logic (via parseAnalysis)', () => {
  it('extracts headline when model returns JSON instead of plain text', () => {
    const { parsed } = parseAnalysis('{"headline":"Prices rose 12%.","analysis":"steady growth"}')
    const extracted = parsed?.one_liner ?? parsed?.headline ?? parsed?.answer ?? parsed?.analysis
    expect(extracted).toBe('Prices rose 12%.')
  })

  it('returns raw text when model returns plain text (parsed is null)', () => {
    const { parsed } = parseAnalysis('Hello world.')
    expect(parsed).toBeNull()
    const result = parsed ? (parsed.one_liner ?? parsed.headline ?? 'Hello world.') : 'Hello world.'
    expect(result).toBe('Hello world.')
  })
})
