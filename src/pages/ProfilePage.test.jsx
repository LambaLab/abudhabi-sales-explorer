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

vi.mock('../components/PostCard', () => ({
  PostCard: ({ post }) => <div data-testid="post-card">{post.analysisText}</div>,
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

  it('expands ReplyContextCard when header button is clicked', () => {
    const replyPost = {
      id: 'rp1',
      userId: 'u2',
      prompt: 'What are top areas?',
      title: 'Top Areas Query',
      status: 'done',
      analysisText: 'Al Reem is top.',
      replies: [
        {
          id: 'r1',
          userId: 'u1',
          prompt: 'Tell me more',
          createdAt: Date.now(),
          status: 'done',
          author: { display_name: 'Nagi Salloum', avatar_url: '' },
        },
      ],
      createdAt: Date.now(),
      chartData: [],
    }
    useProfileFeed.mockReturnValue({
      profile: { id: 'u1', display_name: 'Nagi', avatar_url: '' },
      posts: [],
      replyPosts: [replyPost],
      loading: false,
      error: null,
    })
    renderProfile('u1', { user: { id: 'u1' }, authLoading: false, signInWithGoogle: vi.fn() })

    // Switch to Replies tab
    fireEvent.click(screen.getByRole('tab', { name: /replies/i }))

    // Title visible in collapsed state
    expect(screen.getByText('Top Areas Query')).toBeTruthy()
    // PostCard NOT yet visible
    expect(screen.queryByTestId('post-card')).toBeNull()

    // Click the expand button
    fireEvent.click(screen.getByRole('button', { name: /expand/i }))

    // PostCard now visible (showing analysisText from mock)
    expect(screen.getByTestId('post-card')).toBeTruthy()
    expect(screen.getByText('Al Reem is top.')).toBeTruthy()
  })
})
