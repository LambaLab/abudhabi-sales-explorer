import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../components/PostFeed', () => ({
  PostFeed: () => <div data-testid="post-feed" />,
}))
vi.mock('../components/ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}))
vi.mock('../components/GuestWall', () => ({
  GuestWall: () => <div data-testid="guest-wall" />,
}))

import FeedPage from './FeedPage'

// jsdom does not implement scrollIntoView — stub it so FeedPage doesn't throw
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

function makeCtx(overrides = {}) {
  return {
    ready: true,
    user: { id: 'u1' },
    signInWithGoogle: vi.fn(),
    posts: [],
    removePost: vi.fn(),
    analyze: vi.fn(),
    analyzeReply: vi.fn(),
    analyzeDeep: vi.fn(),
    activePostId: null,
    cancel: vi.fn(),
    settings: { chartType: 'bar' },
    updateSettings: vi.fn(),
    getDateRangeHint: () => '',
    ...overrides,
  }
}

function renderFeed(ctx) {
  return render(
    <MemoryRouter>
      <FeedPage ctx={ctx} />
    </MemoryRouter>
  )
}

describe('FeedPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders without crashing', () => {
    renderFeed(makeCtx())
    expect(screen.getByTestId('post-feed')).toBeTruthy()
  })

  it('shows "new posts" badge when a remote post is added', () => {
    const { rerender } = renderFeed(makeCtx({ posts: [] }))

    const remotePost = { id: 'rp1', userId: 'u2', prompt: 'hello', status: 'done', replies: [], createdAt: Date.now() }
    rerender(
      <MemoryRouter>
        <FeedPage ctx={makeCtx({ posts: [remotePost] })} />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: /new post/i })).toBeTruthy()
  })

  it('does NOT show badge when own post is added', () => {
    const { rerender } = renderFeed(makeCtx({ posts: [] }))

    const ownPost = { id: 'op1', userId: 'u1', prompt: 'my query', status: 'done', replies: [], createdAt: Date.now() }
    rerender(
      <MemoryRouter>
        <FeedPage ctx={makeCtx({ posts: [ownPost] })} />
      </MemoryRouter>
    )

    expect(screen.queryByRole('button', { name: /new post/i })).toBeNull()
  })

  it('clicking new posts badge hides the badge', () => {
    const { rerender } = renderFeed(makeCtx({ posts: [] }))

    const remotePost = { id: 'rp1', userId: 'u2', prompt: 'hello', status: 'done', replies: [], createdAt: Date.now() }
    rerender(
      <MemoryRouter>
        <FeedPage ctx={makeCtx({ posts: [remotePost] })} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /new post/i }))
    expect(screen.queryByRole('button', { name: /new post/i })).toBeNull()
  })
})
