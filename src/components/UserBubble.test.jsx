import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
