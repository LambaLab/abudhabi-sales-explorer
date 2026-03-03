import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { GuestWall } from './GuestWall'

describe('GuestWall', () => {
  it('renders null when user is signed in', () => {
    const { container } = render(
      <GuestWall user={{ id: 'u1' }} postsCount={10} onSignIn={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders null when guest but 3 or fewer posts', () => {
    const { container } = render(
      <GuestWall user={null} postsCount={3} onSignIn={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders sign-in modal when guest and more than 3 posts', () => {
    render(<GuestWall user={null} postsCount={4} onSignIn={vi.fn()} />)
    expect(screen.getByText(/sign in/i)).toBeInTheDocument()
  })

  it('calls onSignIn when the sign-in button is clicked', () => {
    const onSignIn = vi.fn()
    render(<GuestWall user={null} postsCount={5} onSignIn={onSignIn} />)
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))
    expect(onSignIn).toHaveBeenCalledOnce()
  })
})
