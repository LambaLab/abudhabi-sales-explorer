import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReplyCard } from './ReplyCard'

vi.mock('./charts/DynamicChart', () => ({
  DynamicChart: () => <div data-testid="chart-mock" />,
}))

const REPLY = {
  id: 'r1',
  createdAt: Date.now(),
  prompt: 'What about studios?',
  status: 'done',
  analysisText: 'Studios averaged AED 850k.',
  chartData: null,
  chartKeys: null,
  intent: null,
  clarifyOptions: null,
  error: null,
}

describe('ReplyCard', () => {
  it('renders user prompt via UserBubble', () => {
    render(<ReplyCard reply={REPLY} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('What about studios?')).toBeInTheDocument()
  })

  it('renders AI analysisText via AIBubble', () => {
    render(<ReplyCard reply={REPLY} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('Studios averaged AED 850k.')).toBeInTheDocument()
  })
})
