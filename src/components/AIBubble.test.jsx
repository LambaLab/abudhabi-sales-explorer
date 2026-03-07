import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AIBubble } from './AIBubble'

// Recharts doesn't work in jsdom — mock DynamicChart
vi.mock('./charts/DynamicChart', () => ({
  DynamicChart: () => <div data-testid="chart-mock" />,
}))

const BASE = {
  id: 'r1',
  createdAt: Date.now(),
  prompt: 'What trends?',
  status: 'done',
  analysisText: 'Prices rose 12% in Q1.',
  chartData: null,
  chartKeys: null,
  intent: null,
  clarifyOptions: null,
  error: null,
}

describe('AIBubble', () => {
  it('shows analysisText when status is done', () => {
    render(<AIBubble reply={BASE} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('Prices rose 12% in Q1.')).toBeInTheDocument()
  })

  it('shows "Analyzing…" label when status is analyzing', () => {
    render(<AIBubble reply={{ ...BASE, status: 'analyzing', analysisText: null }} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('Analyzing…')).toBeInTheDocument()
  })

  it('shows "Querying data…" label when status is querying', () => {
    render(<AIBubble reply={{ ...BASE, status: 'querying', analysisText: null }} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('Querying data…')).toBeInTheDocument()
  })

  it('shows "Writing…" label when status is explaining', () => {
    render(<AIBubble reply={{ ...BASE, status: 'explaining', analysisText: null }} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('Writing…')).toBeInTheDocument()
  })

  it('renders chart mock when chartData is present', () => {
    render(<AIBubble reply={{ ...BASE, chartData: [{ x: 1 }] }} onReply={() => {}} postId="p1" />)
    expect(screen.getByTestId('chart-mock')).toBeInTheDocument()
  })

  it('renders clarify chips when clarifyOptions present', () => {
    render(<AIBubble
      reply={{ ...BASE, clarifyOptions: ['Price trends', 'Volume'] }}
      onReply={() => {}}
      postId="p1"
    />)
    expect(screen.getByText('Price trends')).toBeInTheDocument()
    expect(screen.getByText('Volume')).toBeInTheDocument()
  })

  it('calls onReply(postId, chip) when chip is clicked', () => {
    const onReply = vi.fn()
    render(<AIBubble
      reply={{ ...BASE, clarifyOptions: ['Price trends'] }}
      onReply={onReply}
      postId="p1"
    />)
    screen.getByText('Price trends').click()
    expect(onReply).toHaveBeenCalledWith('p1', 'Price trends')
  })

  it('shows error text when status is error', () => {
    render(<AIBubble reply={{ ...BASE, status: 'error', error: 'Failed to load' }} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('Failed to load')).toBeInTheDocument()
  })

  it('renders octopus.png (not octopus.svg) as the AI avatar', () => {
    const reply = { status: 'done', analysisText: 'hello', createdAt: Date.now() }
    render(<AIBubble reply={reply} onReply={() => {}} postId="p1" />)
    const img = document.querySelector('img[src="/octopus.png"]')
    expect(img).toBeTruthy()
  })

  it('renders suggestion labels when reply.suggestions is present', () => {
    render(<AIBubble
      reply={{
        ...BASE,
        suggestions: [
          { label: 'Price trend 2024', query: 'price trend 2024', reason: 'internal' },
          { label: 'Volume by district', query: 'volume by district', reason: 'internal' },
        ],
      }}
      onReply={() => {}}
      postId="p1"
    />)
    expect(screen.getByText('Price trend 2024')).toBeInTheDocument()
    expect(screen.getByText('Volume by district')).toBeInTheDocument()
  })

  it('calls onReply with s.query when suggestion button is clicked', () => {
    const onReply = vi.fn()
    render(<AIBubble
      reply={{
        ...BASE,
        suggestions: [
          { label: 'Price trend 2024', query: 'price trend since 2024', reason: 'internal' },
        ],
      }}
      onReply={onReply}
      postId="p1"
    />)
    screen.getByText('Price trend 2024').click()
    expect(onReply).toHaveBeenCalledWith('p1', 'price trend since 2024')
  })
})
