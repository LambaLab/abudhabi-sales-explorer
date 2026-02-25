import { describe, it, expect } from 'vitest'
import { encodePost, decodePost, buildShareUrl, parseShareUrl } from './deeplink'

const SAMPLE_POST = {
  id: 'abc123',
  createdAt: 1700000000000,
  prompt: 'Show 3BR prices in Noya vs Yas Island last year',
  title: '3BR Prices: Noya vs Yas Island (2025)',
  analysisText: 'The median 3-bedroom price in Noya Phase 1 climbed significantly.',
  intent: { queryType: 'project_comparison', filters: { projects: ['Noya - Phase 1'] }, chartType: 'multiline' },
  chartData: [
    { month: '2025-01', 'Noya - Phase 1': 2400000, 'Yas Island': 1900000 },
    { month: '2025-02', 'Noya - Phase 1': 2420000, 'Yas Island': 1910000 },
    { month: '2025-03', 'Noya - Phase 1': 2450000, 'Yas Island': 1925000 },
    { month: '2025-04', 'Noya - Phase 1': 2480000, 'Yas Island': 1940000 },
    { month: '2025-05', 'Noya - Phase 1': 2510000, 'Yas Island': 1955000 },
    { month: '2025-06', 'Noya - Phase 1': 2530000, 'Yas Island': 1970000 },
    { month: '2025-07', 'Noya - Phase 1': 2560000, 'Yas Island': 1985000 },
    { month: '2025-08', 'Noya - Phase 1': 2590000, 'Yas Island': 2000000 },
    { month: '2025-09', 'Noya - Phase 1': 2610000, 'Yas Island': 2015000 },
    { month: '2025-10', 'Noya - Phase 1': 2640000, 'Yas Island': 2030000 },
    { month: '2025-11', 'Noya - Phase 1': 2670000, 'Yas Island': 2045000 },
    { month: '2025-12', 'Noya - Phase 1': 2700000, 'Yas Island': 2060000 },
  ],
  chartKeys: ['Noya - Phase 1', 'Yas Island'],
}

describe('encodePost / decodePost', () => {
  it('round-trips a post object through encode → decode', () => {
    const encoded = encodePost(SAMPLE_POST)
    const decoded = decodePost(encoded)
    expect(decoded).toEqual(SAMPLE_POST)
  })

  it('encoded string is a non-empty string', () => {
    const encoded = encodePost(SAMPLE_POST)
    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(10)
  })

  it('decoded string is shorter than raw JSON', () => {
    const encoded = encodePost(SAMPLE_POST)
    const rawJson = JSON.stringify(SAMPLE_POST)
    // lz-string compression should reduce size
    expect(encoded.length).toBeLessThan(rawJson.length)
  })

  it('returns null for invalid/corrupt encoded string', () => {
    const result = decodePost('this-is-not-valid-lz-data!!!!')
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(decodePost('')).toBeNull()
    expect(decodePost(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(decodePost(undefined)).toBeNull()
  })
})

describe('buildShareUrl', () => {
  it('builds a URL with post id and encoded data params', () => {
    const post = {
      id: 'abc123',
      createdAt: 1700000000000,
      prompt: 'test prompt',
      title: 'Test',
      analysisText: 'Some text here for compression to work properly on this data.',
      intent: { queryType: 'price_trend', filters: {}, chartType: 'line' },
      chartData: [{ month: '2024-01', median_price: 2000000 }],
      chartKeys: [],
    }
    const url = buildShareUrl(post)
    expect(url).toContain('?post=abc123')
    expect(url).toContain('&d=')
    expect(url).toMatch(/^https?:\/\//)
  })

  it('throws if post has no id', () => {
    expect(() => buildShareUrl({ title: 'no id' })).toThrow('post must have an id')
  })
})

describe('parseShareUrl', () => {
  it('returns postId and decoded post from URL search params', () => {
    const post = {
      id: 'xyz789',
      createdAt: 1700000000000,
      prompt: 'another prompt',
      title: 'Title',
      analysisText: 'Analysis text with enough content to compress well.',
      intent: { queryType: 'volume_trend', filters: {}, chartType: 'bar' },
      chartData: [],
      chartKeys: [],
    }
    const encoded = encodePost(post)
    // Set window.location.search directly via jsdom
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: `?post=xyz789&d=${encoded}` },
    })
    const { postId, post: decoded } = parseShareUrl()
    expect(postId).toBe('xyz789')
    expect(decoded).toEqual(post)
  })

  it('returns null post when no d param present', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?post=abc123' },
    })
    const { postId, post } = parseShareUrl()
    expect(postId).toBe('abc123')
    expect(post).toBeNull()
  })
})
