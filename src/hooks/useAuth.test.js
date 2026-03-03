import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSession        = vi.fn()
const mockSignInWithOAuth   = vi.fn()
const mockSignOut           = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockUnsubscribe       = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:         () => mockGetSession(),
      signInWithOAuth:    (opts) => mockSignInWithOAuth(opts),
      signOut:            () => mockSignOut(),
      onAuthStateChange:  (cb) => mockOnAuthStateChange(cb),
    },
  },
}))

import { useAuth } from './useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mockUnsubscribe } } })
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

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useAuth())
    await act(async () => {})
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
