import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
})
