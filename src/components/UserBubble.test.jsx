import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UserBubble } from './UserBubble'

describe('UserBubble', () => {
  it('renders the user prompt text', () => {
    render(<UserBubble prompt="Which project is best?" createdAt={Date.now()} />)
    expect(screen.getByText('Which project is best?')).toBeInTheDocument()
  })

  it('renders a relative timestamp', () => {
    render(<UserBubble prompt="test" createdAt={Date.now()} />)
    expect(screen.getByText(/ago|now/i)).toBeInTheDocument()
  })

  it('shows Google profile image when author.avatar_url is provided', () => {
    const author = { display_name: 'Ada Lovelace', avatar_url: 'https://example.com/ada.jpg' }
    render(<UserBubble prompt="test" createdAt={Date.now()} author={author} />)
    const img = screen.getByRole('img', { name: /ada lovelace/i })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/ada.jpg')
  })

  it('shows generic icon when author is null', () => {
    render(<UserBubble prompt="test" createdAt={Date.now()} author={null} />)
    expect(screen.queryByRole('img', { name: /.+/ })).toBeNull()
  })

  it('shows initials fallback when avatar image fails to load', () => {
    render(<UserBubble
      prompt="hello"
      createdAt={Date.now()}
      author={{ display_name: 'Nagi Salloum', avatar_url: 'http://broken.img/photo.jpg' }}
    />)
    const img = screen.getByRole('img', { hidden: true })
    fireEvent.error(img)
    // After error, initials 'NS' should appear
    expect(screen.getByText('NS')).toBeTruthy()
  })

  it('shows initials from display_name when no avatar_url', () => {
    render(<UserBubble
      prompt="hello"
      createdAt={Date.now()}
      author={{ display_name: 'Nagi Salloum', avatar_url: '' }}
    />)
    expect(screen.getByText('NS')).toBeTruthy()
  })

  it('outer container uses flex-row-reverse and inner content uses items-end', () => {
    const { container } = render(
      <UserBubble
        prompt="hello"
        createdAt={Date.now()}
        author={{ display_name: 'Nagi Salloum', avatar_url: '' }}
      />
    )
    const outer = container.firstChild
    expect(outer.className).toMatch(/flex-row-reverse/)
    const avatarCircle = container.querySelector('.rounded-full')
    const bubble = container.querySelector('.rounded-xl')
    // In flex-row-reverse: avatar is right column, bubble is in left column
    expect(avatarCircle.parentElement).not.toBe(bubble.parentElement)
    // Inner content div has items-end for right-anchoring
    expect(bubble.parentElement.className).toMatch(/items-end/)
  })

  it('timestamp paragraph uses flex-row-reverse', () => {
    const { container } = render(
      <UserBubble prompt="test" createdAt={Date.now()} />
    )
    const timestamp = container.querySelector('p')
    expect(timestamp.className).toMatch(/flex-row-reverse/)
  })

  it('shows author name as a link to their profile when userId and display_name are provided', () => {
    render(
      <MemoryRouter>
        <UserBubble
          prompt="test"
          createdAt={Date.now()}
          author={{ display_name: 'Nagi Salloum', avatar_url: '' }}
          userId="user-123"
        />
      </MemoryRouter>
    )
    const link = screen.getByRole('link', { name: /nagi salloum/i })
    expect(link).toBeTruthy()
    expect(link).toHaveAttribute('href', '/profile/user-123')
  })

  it('does not show a name link when userId is not provided', () => {
    render(
      <UserBubble
        prompt="test"
        createdAt={Date.now()}
        author={{ display_name: 'Nagi Salloum', avatar_url: '' }}
      />
    )
    expect(screen.queryByRole('link')).toBeNull()
  })
})
