import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChartSwitcher } from './ChartSwitcher'

// Mock heavy chart deps
vi.mock('./charts/DynamicChart', () => ({
  DynamicChart: ({ chartType }) => <div data-testid="chart">{chartType}</div>,
}))
vi.mock('./DateRangePickerPopover', () => ({
  DateRangePickerPopover: () => <div data-testid="date-picker" />,
}))
vi.mock('../utils/db', () => ({ query: vi.fn().mockResolvedValue([]) }))

// vi.mock is hoisted before imports, so this resolves to the mock
import { query as mockQuery } from '../utils/db'

function makePost(overrides = {}) {
  return {
    id: 'p1',
    chartData: [{ month: '2024-01', value: 1000000 }],
    chartKeys: [],
    intent: {
      queryType: 'price_trend',
      chartType: 'line',
      chartNeeded: true,
      suggestedCharts: ['line', 'bar', 'volume'],
      adaptiveFormat: 'trend',
      filters: {},
    },
    ...overrides,
  }
}

describe('ChartSwitcher', () => {
  beforeEach(() => {
    mockQuery.mockClear()
  })

  it('renders the chart when chartNeeded is true', () => {
    render(<ChartSwitcher post={makePost()} />)
    expect(screen.getByTestId('chart')).toBeInTheDocument()
  })

  it('does NOT render chart when chartNeeded is false initially', () => {
    const post = makePost({ chartData: null, intent: { ...makePost().intent, chartNeeded: false } })
    render(<ChartSwitcher post={post} />)
    expect(screen.queryByTestId('chart')).toBeNull()
  })

  it('renders chip buttons from suggestedCharts', () => {
    render(<ChartSwitcher post={makePost()} />)
    expect(screen.getByRole('button', { name: /line/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /volume/i })).toBeInTheDocument()
  })

  it('highlights the active chip matching intent.chartType', () => {
    render(<ChartSwitcher post={makePost()} />)
    const lineBtn = screen.getByRole('button', { name: /^line$/i })
    expect(lineBtn.className).toMatch(/bg-accent/)
  })

  it('switches active chip when another chip is clicked', () => {
    render(<ChartSwitcher post={makePost()} />)
    const barBtn = screen.getByRole('button', { name: /^bar$/i })
    fireEvent.click(barBtn)
    expect(barBtn.className).toMatch(/bg-accent/)
  })

  it('renders no chips when suggestedCharts is empty', () => {
    const post = makePost({ intent: { ...makePost().intent, suggestedCharts: [] } })
    render(<ChartSwitcher post={post} />)
    expect(screen.queryByRole('button', { name: /line|bar|volume/i })).toBeNull()
  })

  it('collapses chart when active chip is clicked again on chartNeeded: false post', async () => {
    const post = makePost({
      chartData: [{ month: '2024-01', value: 1000000 }],
      intent: {
        ...makePost().intent,
        chartNeeded: false,
        suggestedCharts: ['line', 'bar'],
      },
    })
    render(<ChartSwitcher post={post} />)
    // No chart initially
    expect(screen.queryByTestId('chart')).toBeNull()
    // Click to show chart
    fireEvent.click(screen.getByRole('button', { name: /^line$/i }))
    expect(screen.getByTestId('chart')).toBeInTheDocument()
    // Click same chip to collapse
    fireEvent.click(screen.getByRole('button', { name: /^line$/i }))
    await waitFor(() => expect(screen.queryByTestId('chart')).toBeNull())
  })

  it('calls query when chip has a different queryType than the post intent', async () => {
    render(<ChartSwitcher post={makePost()} />)
    // 'volume' chip has queryType 'volume_trend', post has 'price_trend' → triggers DuckDB query
    fireEvent.click(screen.getByRole('button', { name: /volume/i }))
    await waitFor(() => expect(mockQuery).toHaveBeenCalled())
  })

  it('renders nothing when post.noData is true', () => {
    const post = makePost({ noData: true })
    const { container } = render(<ChartSwitcher post={post} />)
    expect(container.firstChild).toBeNull()
  })
})
