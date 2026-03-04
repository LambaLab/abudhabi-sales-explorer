import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Mock useProfileFeed
vi.mock('../hooks/useProfileFeed', () => ({
  useProfileFeed: vi.fn(),
}))
import { useProfileFeed } from '../hooks/useProfileFeed'

// Mock SignInModal
vi.mock('../components/SignInModal', () => ({
  SignInModal: ({ open, onClose }) =>
    open ? <div data-testid="sign-in-modal"><button onClick={onClose}>close</button></div> : null,
}))

import ProfilePage from './ProfilePage'

function renderProfile(userId, ctx) {
  return render(
    <MemoryRouter initialEntries={[`/profile/${userId}`]}>
      <Routes>
        <Route path="/profile/:userId" element={<ProfilePage ctx={ctx} />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProfilePage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows SignInModal when user is not signed in', () => {
    useProfileFeed.mockReturnValue({ profile: null, posts: [], replyPosts: [], loading: false })
    renderProfile('u1', { user: null, authLoading: false, signInWithGoogle: vi.fn() })
    expect(screen.getByTestId('sign-in-modal')).toBeTruthy()
  })

  it('shows profile name when signed in', () => {
    useProfileFeed.mockReturnValue({
      profile: { id: 'u1', display_name: 'Nagi Salloum', avatar_url: '' },
      posts: [], replyPosts: [], loading: false,
    })
    renderProfile('u1', { user: { id: 'u1' }, authLoading: false, signInWithGoogle: vi.fn() })
    expect(screen.getByText('Nagi Salloum')).toBeTruthy()
  })

  it('shows post count', () => {
    useProfileFeed.mockReturnValue({
      profile: { id: 'u1', display_name: 'Ada', avatar_url: '' },
      posts: [
        { id: 'p1', userId: 'u1', prompt: 'q', status: 'done', replies: [], createdAt: Date.now(), analysisText: 'a' },
      ],
      replyPosts: [], loading: false,
    })
    renderProfile('u1', { user: { id: 'u1' }, authLoading: false, signInWithGoogle: vi.fn() })
    expect(screen.getByText(/1 post/i)).toBeTruthy()
  })

  it('renders Posts and Replies tabs', () => {
    useProfileFeed.mockReturnValue({ profile: { id: 'u1', display_name: 'Ada', avatar_url: '' }, posts: [], replyPosts: [], loading: false })
    renderProfile('u1', { user: { id: 'u1' }, authLoading: false, signInWithGoogle: vi.fn() })
    expect(screen.getByRole('tab', { name: /posts/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /replies/i })).toBeTruthy()
  })

  it('switches to Replies tab on click', () => {
    useProfileFeed.mockReturnValue({
      profile: { id: 'u1', display_name: 'Ada', avatar_url: '' },
      posts: [],
      replyPosts: [], loading: false,
    })
    renderProfile('u1', { user: { id: 'u1' }, authLoading: false, signInWithGoogle: vi.fn() })
    fireEvent.click(screen.getByRole('tab', { name: /replies/i }))
    // Tab is now selected (aria-selected=true)
    expect(screen.getByRole('tab', { name: /replies/i }).getAttribute('aria-selected')).toBe('true')
  })
})
