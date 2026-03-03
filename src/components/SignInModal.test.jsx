import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SignInModal } from './SignInModal'

describe('SignInModal', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <SignInModal open={false} onClose={() => {}} onSignIn={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows headline and Google sign-in button when open=true', () => {
    render(<SignInModal open={true} onClose={() => {}} onSignIn={() => {}} />)
    expect(screen.getByText(/sign in to join/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeTruthy()
  })

  it('calls onSignIn when Google button is clicked', () => {
    const onSignIn = vi.fn()
    render(<SignInModal open={true} onClose={() => {}} onSignIn={onSignIn} />)
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))
    expect(onSignIn).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    render(<SignInModal open={true} onClose={onClose} onSignIn={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking the backdrop', () => {
    const onClose = vi.fn()
    const { container } = render(
      <SignInModal open={true} onClose={onClose} onSignIn={() => {}} />
    )
    // The backdrop is the outermost div with the onClick handler
    fireEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
