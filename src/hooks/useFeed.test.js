import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom          = vi.fn()
const mockChannel       = vi.fn()
const mockRemoveChannel = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from:          (...args) => mockFrom(...args),
    channel:       (...args) => mockChannel(...args),
    removeChannel: (...args) => mockRemoveChannel(...args),
  },
}))

function makeQuery(resolvedValue = { data: [], error: null }) {
  const q = {
    select:  vi.fn().mockReturnThis(),
    order:   vi.fn().mockReturnThis(),
    eq:      vi.fn().mockReturnThis(),
    single:  vi.fn().mockReturnThis(),
    upsert:  vi.fn().mockResolvedValue({ error: null }),
    delete:  vi.fn().mockReturnThis(),
    then:    (cb) => Promise.resolve(resolvedValue).then(cb),
  }
  return q
}

function makeChannel() {
  const handlers = {}
  const ch = {
    on: vi.fn().mockImplementation((_type, filter, cb) => {
      const key = `${filter.event}:${filter.table}`
      handlers[key] = cb
      return ch
    }),
    subscribe: vi.fn().mockReturnValue(undefined),
    _fire: (event, table, payload) => {
      const key = `${event}:${table}`
      handlers[key]?.(payload)
    },
  }
  return ch
}

import { useFeed } from './useFeed'

describe('useFeed', () => {
  let query
  let channel

  beforeEach(() => {
    vi.clearAllMocks()
    query   = makeQuery({ data: [], error: null })
    channel = makeChannel()
    mockFrom.mockReturnValue(query)
    mockChannel.mockReturnValue(channel)
  })

  it('starts empty and loads from Supabase on mount', async () => {
    query = makeQuery({ data: [
      { id: 'p1', user_id: 'u1', created_at: new Date().toISOString(),
        prompt: 'hello', title: 'Hello', status: 'done',
        analysis_text: 'test', author: { display_name: 'Ada', avatar_url: '' },
        replies: [] }
    ], error: null })
    mockFrom.mockReturnValue(query)

    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => expect(result.current.posts).toHaveLength(1))
    expect(result.current.posts[0].id).toBe('p1')
    expect(result.current.posts[0].analysisText).toBe('test')
  })

  it('addPost appends to local state', async () => {
    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => expect(result.current.posts).toHaveLength(0))
    act(() => result.current.addPost({ id: 'x1', prompt: 'p', status: 'analyzing', replies: [] }))
    expect(result.current.posts).toHaveLength(1)
    expect(result.current.posts[0].id).toBe('x1')
  })

  it('addPost dedupes — last write wins on same id', async () => {
    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => expect(result.current.posts).toHaveLength(0))
    act(() => result.current.addPost({ id: 'dup', prompt: 'a', status: 'analyzing', replies: [] }))
    act(() => result.current.addPost({ id: 'dup', prompt: 'b', status: 'analyzing', replies: [] }))
    expect(result.current.posts).toHaveLength(1)
    expect(result.current.posts[0].prompt).toBe('b')
  })

  it('patchPost with status=done AND user → calls supabase.from(posts).upsert()', async () => {
    const fakeUser = { id: 'u1' }
    const { result } = renderHook(() => useFeed({ user: fakeUser }))
    await waitFor(() => {})
    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'analyzing', createdAt: Date.now(), replies: [] }))
    act(() => result.current.patchPost('p1', { status: 'done', analysisText: 'done text' }))
    expect(mockFrom).toHaveBeenCalledWith('posts')
    expect(query.upsert).toHaveBeenCalled()
  })

  it('patchPost with status=done but NO user → does NOT call upsert', async () => {
    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => {})
    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'analyzing', replies: [] }))
    act(() => result.current.patchPost('p1', { status: 'done' }))
    expect(query.upsert).not.toHaveBeenCalled()
  })

  it('patchPost with status!=done → does NOT call upsert', async () => {
    const fakeUser = { id: 'u1' }
    const { result } = renderHook(() => useFeed({ user: fakeUser }))
    await waitFor(() => {})
    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'analyzing', replies: [] }))
    act(() => result.current.patchPost('p1', { status: 'querying' }))
    expect(query.upsert).not.toHaveBeenCalled()
  })

  it('removePost removes from state and calls supabase delete', async () => {
    const fakeUser = { id: 'u1' }
    const { result } = renderHook(() => useFeed({ user: fakeUser }))
    await waitFor(() => {})
    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'done', replies: [] }))
    act(() => result.current.removePost('p1'))
    expect(result.current.posts).toHaveLength(0)
    expect(mockFrom).toHaveBeenCalledWith('posts')
    expect(query.delete).toHaveBeenCalled()
  })

  it('real-time INSERT for new post → appends after secondary fetch', async () => {
    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => {})
    const newRow = {
      id: 'rt1', user_id: 'u1', created_at: new Date().toISOString(),
      prompt: 'rt post', title: '', status: 'done', analysis_text: '',
      replies: [], author: { display_name: 'Bob', avatar_url: '' },
    }
    query = makeQuery({ data: newRow, error: null })
    mockFrom.mockReturnValue(query)
    await act(async () => {
      channel._fire('INSERT', 'posts', { new: { id: 'rt1' } })
      await new Promise(r => setTimeout(r, 0))
    })
    expect(result.current.posts.some(p => p.id === 'rt1')).toBe(true)
  })

  it('real-time INSERT for already-known id → dedupes', async () => {
    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => {})
    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'done', replies: [] }))
    await act(async () => {
      channel._fire('INSERT', 'posts', { new: { id: 'p1' } })
      await new Promise(r => setTimeout(r, 0))
    })
    expect(result.current.posts).toHaveLength(1)
  })

  it('real-time DELETE → removes post from state', async () => {
    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => {})
    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'done', replies: [] }))
    act(() => channel._fire('DELETE', 'posts', { old: { id: 'p1' } }))
    expect(result.current.posts).toHaveLength(0)
  })

  it('patchReply with status=done AND user → calls supabase.from(replies).upsert()', async () => {
    const fakeUser = { id: 'u1' }
    const { result } = renderHook(() => useFeed({ user: fakeUser }))
    await waitFor(() => {})
    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'done', replies: [] }))
    act(() => result.current.addReply('p1', { id: 'r1', prompt: 'follow up', createdAt: Date.now(), status: 'analyzing' }))
    act(() => result.current.patchReply('p1', 'r1', { status: 'done', analysisText: 'reply done' }))
    expect(mockFrom).toHaveBeenCalledWith('replies')
    expect(query.upsert).toHaveBeenCalled()
  })
})
