import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSettings } from './useSettings'

beforeEach(() => localStorage.clear())

describe('useSettings', () => {
  it('defaults chartType to bar', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current.settings.chartType).toBe('bar')
  })

  it('persists chartType update to localStorage', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.updateSettings({ chartType: 'line' }))
    expect(result.current.settings.chartType).toBe('line')
    const saved = JSON.parse(localStorage.getItem('ad_settings'))
    expect(saved.chartType).toBe('line')
  })
})
