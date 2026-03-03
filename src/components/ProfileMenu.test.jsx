import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileMenu } from './ProfileMenu'

const userWithAvatar = {
  email: 'nagi@example.com',
  user_metadata: {
    full_name: 'Nagi Salloum',
    avatar_url: 'https://example.com/avatar.jpg',
  },
}

const userWithoutAvatar = {
  email: 'nagi@example.com',
  user_metadata: {
    full_name: 'Nagi Salloum',
    avatar_url: '',
  },
}

describe('ProfileMenu', () => {
  it('renders an avatar image when user has avatar_url', () => {
    render(<ProfileMenu user={userWithAvatar} onSignOut={vi.fn()} />)
    const img = screen.getByRole('img', { name: /nagi salloum/i })
    expect(img).toBeTruthy()
    expect(img.src).toContain('avatar.jpg')
  })

  it('renders initials when user has no avatar_url', () => {
    render(<ProfileMenu user={userWithoutAvatar} onSignOut={vi.fn()} />)
    // "NS" initials for "Nagi Salloum"
    expect(screen.getByText('NS')).toBeTruthy()
  })

  it('dropdown is hidden initially', () => {
    render(<ProfileMenu user={userWithAvatar} onSignOut={vi.fn()} />)
    expect(screen.queryByText('nagi@example.com')).toBeNull()
  })

  it('clicking avatar opens dropdown with name and email', () => {
    render(<ProfileMenu user={userWithAvatar} onSignOut={vi.fn()} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Nagi Salloum')).toBeTruthy()
    expect(screen.getByText('nagi@example.com')).toBeTruthy()
  })

  it('dropdown has a Sign out button', () => {
    render(<ProfileMenu user={userWithAvatar} onSignOut={vi.fn()} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy()
  })

  it('Sign out button calls onSignOut', () => {
    const onSignOut = vi.fn()
    render(<ProfileMenu user={userWithAvatar} onSignOut={onSignOut} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('pressing Escape closes the dropdown', () => {
    render(<ProfileMenu user={userWithAvatar} onSignOut={vi.fn()} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('nagi@example.com')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('nagi@example.com')).toBeNull()
  })
})
