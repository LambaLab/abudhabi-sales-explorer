import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePostStore } from './usePostStore'

// jsdom provides localStorage automatically in test environment

beforeEach(() => {
  localStorage.clear()
})

const makePost = (id = 'p1') => ({
  id,
  createdAt: Date.now(),
  prompt: 'Test prompt',
  title: 'Test title',
  analysisText: 'Test analysis',
  intent: { queryType: 'price_trend', filters: {}, chartType: 'line' },
  chartData: [],
  chartKeys: [],
})

describe('usePostStore', () => {
  it('starts with empty posts', () => {
    const { result } = renderHook(() => usePostStore())
    expect(result.current.posts).toEqual([])
  })

  it('addPost adds a post and it appears in posts list', () => {
    const { result } = renderHook(() => usePostStore())
    const post = makePost('p1')
    act(() => result.current.addPost(post))
    expect(result.current.posts).toHaveLength(1)
    expect(result.current.posts[0].id).toBe('p1')
  })

  it('newest posts appear first', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost('p1')))
    act(() => result.current.addPost(makePost('p2')))
    expect(result.current.posts[0].id).toBe('p2')
    expect(result.current.posts[1].id).toBe('p1')
  })

  it('getPost returns post by id', () => {
    const { result } = renderHook(() => usePostStore())
    const post = makePost('abc')
    act(() => result.current.addPost(post))
    const found = result.current.getPost('abc')
    expect(found?.id).toBe('abc')
  })

  it('getPost returns undefined for unknown id', () => {
    const { result } = renderHook(() => usePostStore())
    expect(result.current.getPost('nope')).toBeUndefined()
  })

  it('removePost removes a post from the list', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost('p1')))
    act(() => result.current.addPost(makePost('p2')))
    act(() => result.current.removePost('p1'))
    expect(result.current.posts).toHaveLength(1)
    expect(result.current.posts[0].id).toBe('p2')
  })

  it('persists posts across hook re-mounts (localStorage)', () => {
    const { result: r1, unmount } = renderHook(() => usePostStore())
    act(() => r1.current.addPost(makePost('p1')))
    unmount()
    const { result: r2 } = renderHook(() => usePostStore())
    expect(r2.current.posts).toHaveLength(1)
    expect(r2.current.posts[0].id).toBe('p1')
  })
})
