import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

function makeQuery(resolved) {
  return {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    in:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: (cb) => Promise.resolve(resolved).then(cb),
  }
}

import { useProfileFeed } from './useProfileFeed'

describe('useProfileFeed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches profile info for the given userId', async () => {
    const profileQuery = makeQuery({ data: { id: 'u1', display_name: 'Ada', avatar_url: 'http://a.com/a.jpg' }, error: null })
    const postsQuery   = makeQuery({ data: [], error: null })
    const repliesQuery = makeQuery({ data: [], error: null })

    mockFrom.mockImplementation((table) => {
      if (table === 'profiles') return profileQuery
      if (table === 'replies')  return repliesQuery
      return postsQuery
    })

    const { result } = renderHook(() => useProfileFeed('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.profile).toEqual({ id: 'u1', display_name: 'Ada', avatar_url: 'http://a.com/a.jpg' })
  })

  it('returns posts for the userId', async () => {
    const postRow = {
      id: 'p1', user_id: 'u1', created_at: new Date().toISOString(),
      prompt: 'q', title: 'Q', status: 'done', analysis_text: 'text',
      author: { display_name: 'Ada', avatar_url: '' }, replies: [],
    }
    const profileQuery = makeQuery({ data: { id: 'u1', display_name: 'Ada', avatar_url: '' }, error: null })
    const postsQuery   = makeQuery({ data: [postRow], error: null })
    const repliesQuery = makeQuery({ data: [], error: null })

    mockFrom.mockImplementation((table) => {
      if (table === 'profiles') return profileQuery
      if (table === 'replies')  return repliesQuery
      return postsQuery
    })

    const { result } = renderHook(() => useProfileFeed('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.posts).toHaveLength(1)
    expect(result.current.posts[0].id).toBe('p1')
  })

  it('returns empty arrays when userId is null', async () => {
    const { result } = renderHook(() => useProfileFeed(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.posts).toHaveLength(0)
    expect(result.current.replyPosts).toHaveLength(0)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
