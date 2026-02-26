import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePostStore } from './usePostStore'

// Isolate localStorage between tests
beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

const makePost = (overrides = {}) => ({
  id: 'p1',
  createdAt: 1000,
  prompt: 'test prompt',
  title: 'Test',
  status: 'done',
  error: null,
  analysisText: 'hello',
  intent: null,
  chartData: null,
  chartKeys: null,
  replies: [],
  ...overrides,
})

describe('usePostStore — addPost', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => usePostStore())
    expect(result.current.posts).toEqual([])
  })

  it('appends post to the END (newest at bottom)', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost({ id: 'a' })))
    act(() => result.current.addPost(makePost({ id: 'b' })))
    expect(result.current.posts[0].id).toBe('a')
    expect(result.current.posts[1].id).toBe('b')
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost()))
    const stored = JSON.parse(localStorage.getItem('ad_posts_v2'))
    expect(stored[0].id).toBe('p1')
  })

  it('loads from localStorage on init', () => {
    localStorage.setItem('ad_posts_v2', JSON.stringify([makePost()]))
    const { result } = renderHook(() => usePostStore())
    expect(result.current.posts).toHaveLength(1)
  })
})

describe('usePostStore — removePost', () => {
  it('removes by id', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost()))
    act(() => result.current.removePost('p1'))
    expect(result.current.posts).toHaveLength(0)
  })

  it('removes the item from localStorage', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost()))
    act(() => result.current.removePost('p1'))
    const stored = JSON.parse(localStorage.getItem('ad_posts_v2'))
    expect(stored.find(p => p.id === 'p1')).toBeUndefined()
  })
})

describe('usePostStore — getPost', () => {
  it('finds by id', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost()))
    expect(result.current.getPost('p1')?.id).toBe('p1')
  })

  it('returns undefined for missing id', () => {
    const { result } = renderHook(() => usePostStore())
    expect(result.current.getPost('nope')).toBeUndefined()
  })
})

describe('usePostStore — patchPost', () => {
  it('merges partial fields onto matching post', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost({ status: 'analyzing' })))
    act(() => result.current.patchPost('p1', { status: 'done', analysisText: 'final' }))
    const p = result.current.getPost('p1')
    expect(p.status).toBe('done')
    expect(p.analysisText).toBe('final')
    expect(p.title).toBe('Test')  // unchanged field preserved
  })

  it('persists patch to localStorage', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost()))
    act(() => result.current.patchPost('p1', { title: 'Updated' }))
    const stored = JSON.parse(localStorage.getItem('ad_posts_v2'))
    expect(stored[0].title).toBe('Updated')
  })
})

describe('usePostStore — addReply', () => {
  it('pushes a reply onto the correct post', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost()))
    act(() => result.current.addReply('p1', { id: 'r1', prompt: 'follow-up', status: 'analyzing' }))
    expect(result.current.getPost('p1').replies).toHaveLength(1)
    expect(result.current.getPost('p1').replies[0].id).toBe('r1')
  })

  it('leaves other posts untouched', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost({ id: 'a' })))
    act(() => result.current.addPost(makePost({ id: 'b' })))
    act(() => result.current.addReply('a', { id: 'r1', prompt: 'q' }))
    expect(result.current.getPost('b').replies).toHaveLength(0)
  })

  it('persists the reply to localStorage', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost()))
    act(() => result.current.addReply('p1', { id: 'r1', prompt: 'follow-up', status: 'analyzing' }))
    const stored = JSON.parse(localStorage.getItem('ad_posts_v2'))
    const storedPost = stored.find(p => p.id === 'p1')
    expect(storedPost.replies).toHaveLength(1)
    expect(storedPost.replies[0].id).toBe('r1')
  })
})

describe('usePostStore — patchReply', () => {
  it('merges partial fields onto the correct reply', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost()))
    act(() => result.current.addReply('p1', { id: 'r1', status: 'analyzing', analysisText: '' }))
    act(() => result.current.patchReply('p1', 'r1', { status: 'done', analysisText: 'reply text' }))
    const reply = result.current.getPost('p1').replies[0]
    expect(reply.status).toBe('done')
    expect(reply.analysisText).toBe('reply text')
  })

  it('persists the patched reply fields to localStorage', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost()))
    act(() => result.current.addReply('p1', { id: 'r1', status: 'analyzing', analysisText: '' }))
    act(() => result.current.patchReply('p1', 'r1', { status: 'done', analysisText: 'reply text' }))
    const stored = JSON.parse(localStorage.getItem('ad_posts_v2'))
    const storedReply = stored.find(p => p.id === 'p1').replies[0]
    expect(storedReply.status).toBe('done')
    expect(storedReply.analysisText).toBe('reply text')
  })
})
