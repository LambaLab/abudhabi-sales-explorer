import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FeedTabs } from './FeedTabs'

const POSTS = [
  { id: 'p1', userId: 'u1', prompt: 'post 1', replies: [] },
  { id: 'p2', userId: 'u2', prompt: 'post 2', replies: [{ userId: 'u1' }] },
  { id: 'p3', userId: 'u3', prompt: 'post 3', replies: [] },
]
const USER = { id: 'u1' }

describe('FeedTabs', () => {
  it('renders All Posts and My Feed tabs when signed in', () => {
    render(<FeedTabs posts={POSTS} user={USER} onPostsChange={vi.fn()} />)
    expect(screen.getByRole('tab', { name: /all posts/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /my feed/i })).toBeInTheDocument()
  })

  it('renders nothing when user is null', () => {
    const { container } = render(<FeedTabs posts={POSTS} user={null} onPostsChange={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('All Posts tab passes all posts to onPostsChange', () => {
    const onPostsChange = vi.fn()
    render(<FeedTabs posts={POSTS} user={USER} onPostsChange={onPostsChange} />)
    fireEvent.click(screen.getByRole('tab', { name: /all posts/i }))
    expect(onPostsChange).toHaveBeenCalledWith(POSTS)
  })

  it('My Feed tab passes only posts created by or replied to by user', () => {
    const onPostsChange = vi.fn()
    render(<FeedTabs posts={POSTS} user={USER} onPostsChange={onPostsChange} />)
    fireEvent.click(screen.getByRole('tab', { name: /my feed/i }))
    const result = onPostsChange.mock.lastCall[0]
    expect(result.map(p => p.id)).toEqual(['p1', 'p2'])
  })
})
