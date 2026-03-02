import { describe, it, expect } from 'vitest'
import { relativeTime } from './relativeTime'

describe('relativeTime', () => {
  it('returns "just now" for timestamps less than 60 seconds ago', () => {
    expect(relativeTime(Date.now() - 5_000)).toBe('just now')
  })

  it('returns "Xm ago" for timestamps between 1 and 59 minutes ago', () => {
    expect(relativeTime(Date.now() - 3 * 60_000)).toBe('3m ago')
  })

  it('returns "Xh ago" for timestamps 1+ hours ago', () => {
    expect(relativeTime(Date.now() - 2 * 3_600_000)).toBe('2h ago')
  })
})
