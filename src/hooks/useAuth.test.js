import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSession        = vi.fn()
const mockSignInWithOAuth   = vi.fn()
const mockSignOut           = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockUnsubscribe       = vi.fn()
const mockUpsert            = vi.fn()
const mockFrom              = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:         () => mockGetSession(),
      signInWithOAuth:    (opts) => mockSignInWithOAuth(opts),
      signOut:            () => mockSignOut(),
      onAuthStateChange:  (cb) => mockOnAuthStateChange(cb),
    },
    from: (table) => mockFrom(table),
  },
}))

import { useAuth } from './useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mockUnsubscribe } } })
    mockFrom.mockReturnValue({ upsert: mockUpsert })
    mockUpsert.mockResolvedValue({ error: null })
  })

  it('user is null initially (no session)', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    expect(result.current.user).toBeNull()
  })

  it('user is populated when session exists', async () => {
    const fakeUser = { id: 'u1', user_metadata: { full_name: 'Ada', avatar_url: 'https://avatar' } }
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeUser } } })
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    expect(result.current.user).toEqual(fakeUser)
  })

  it('signInWithGoogle calls supabase.auth.signInWithOAuth with google provider', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    act(() => result.current.signInWithGoogle())
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    )
  })

  it('signOut calls supabase.auth.signOut', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    act(() => result.current.signOut())
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('user updates when onAuthStateChange fires', async () => {
    let capturedCb
    mockOnAuthStateChange.mockImplementation(cb => {
      capturedCb = cb
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    const fakeUser = { id: 'u2', user_metadata: {} }
    act(() => capturedCb('SIGNED_IN', { user: fakeUser }))
    expect(result.current.user).toEqual(fakeUser)
  })

  it('loading is true before session resolves and false after', async () => {
    let resolveSession
    mockGetSession.mockReturnValue(new Promise(res => { resolveSession = res }))
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
    await act(async () => {
      resolveSession({ data: { session: null } })
    })
    expect(result.current.loading).toBe(false)
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useAuth())
    await act(async () => {})
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('upserts profile with avatar_url and display_name on SIGNED_IN', async () => {
    let capturedCb
    mockOnAuthStateChange.mockImplementation(cb => {
      capturedCb = cb
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })
    renderHook(() => useAuth())
    await act(async () => {})

    const fakeUser = {
      id: 'u1',
      user_metadata: { full_name: 'Nagi Salloum', avatar_url: 'https://google/photo.jpg' },
    }
    await act(async () => {
      capturedCb('SIGNED_IN', { user: fakeUser })
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockUpsert).toHaveBeenCalledWith(
      { id: 'u1', display_name: 'Nagi Salloum', avatar_url: 'https://google/photo.jpg' },
      { onConflict: 'id' }
    )
  })
})
