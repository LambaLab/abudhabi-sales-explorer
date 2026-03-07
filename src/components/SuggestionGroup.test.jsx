import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuggestionGroup } from './SuggestionGroup'

const SUGGESTIONS = [
  { label: 'Price trend 2024', query: 'price trend 2024', reason: 'Monthly data available for 2024' },
  { label: 'Volume by district', query: 'volume by district', reason: 'District-level records exist' },
]

describe('SuggestionGroup', () => {
  it('renders all suggestion labels', () => {
    render(<SuggestionGroup suggestions={SUGGESTIONS} postId="p1" onReply={() => {}} />)
    expect(screen.getByText('Price trend 2024')).toBeInTheDocument()
    expect(screen.getByText('Volume by district')).toBeInTheDocument()
  })

  it('renders reason as subtitle below each label', () => {
    render(<SuggestionGroup suggestions={SUGGESTIONS} postId="p1" onReply={() => {}} />)
    expect(screen.getByText('Monthly data available for 2024')).toBeInTheDocument()
    expect(screen.getByText('District-level records exist')).toBeInTheDocument()
  })

  it('shows numbered badges (1, 2)', () => {
    render(<SuggestionGroup suggestions={SUGGESTIONS} postId="p1" onReply={() => {}} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('calls onReply(postId, s.query) when suggestion row is clicked', () => {
    const onReply = vi.fn()
    render(<SuggestionGroup suggestions={SUGGESTIONS} postId="p1" onReply={onReply} />)
    fireEvent.click(screen.getByText('Price trend 2024'))
    expect(onReply).toHaveBeenCalledWith('p1', 'price trend 2024')
  })

  it('shows "Type something else…" row when showTypeAnything is true', () => {
    render(<SuggestionGroup suggestions={SUGGESTIONS} postId="p1" onReply={() => {}} showTypeAnything />)
    expect(screen.getByText('Type something else…')).toBeInTheDocument()
  })

  it('does NOT show "Type something else…" row when showTypeAnything is false/omitted', () => {
    render(<SuggestionGroup suggestions={SUGGESTIONS} postId="p1" onReply={() => {}} />)
    expect(screen.queryByText('Type something else…')).toBeNull()
  })

  it('expanding "Type something else…" shows a textarea', () => {
    render(<SuggestionGroup suggestions={SUGGESTIONS} postId="p1" onReply={() => {}} showTypeAnything />)
    fireEvent.click(screen.getByText('Type something else…'))
    expect(screen.getByPlaceholderText('Ask a follow-up…')).toBeInTheDocument()
  })

  it('submitting the textarea calls onReply(postId, trimmedText)', () => {
    const onReply = vi.fn()
    render(<SuggestionGroup suggestions={SUGGESTIONS} postId="p1" onReply={onReply} showTypeAnything />)
    fireEvent.click(screen.getByText('Type something else…'))
    const textarea = screen.getByPlaceholderText('Ask a follow-up…')
    fireEvent.change(textarea, { target: { value: 'My custom query' } })
    fireEvent.submit(textarea.closest('form'))
    expect(onReply).toHaveBeenCalledWith('p1', 'My custom query')
  })

  it('renders nothing when suggestions is empty', () => {
    const { container } = render(<SuggestionGroup suggestions={[]} postId="p1" onReply={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})
