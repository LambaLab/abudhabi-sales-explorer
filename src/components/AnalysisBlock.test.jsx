import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisBlock } from './AnalysisBlock'

describe('AnalysisBlock', () => {
  it('renders plain text as-is when not valid JSON (backward compat)', () => {
    render(<AnalysisBlock text="Median prices rose 18% last year." adaptiveFormat="trend" />)
    expect(screen.getByText(/Median prices rose/)).toBeInTheDocument()
  })

  it('renders headline from parsed JSON trend response', () => {
    const json = JSON.stringify({
      headline: '+18.4% — Yas Island leads Abu Dhabi',
      keyMetrics: [{ label: 'Latest', value: 'AED 1,480,000' }],
      analysis: 'Strong growth story.',
      recommendation: 'Buy now.',
    })
    render(<AnalysisBlock text={json} adaptiveFormat="trend" />)
    expect(screen.getByText('+18.4% — Yas Island leads Abu Dhabi')).toBeInTheDocument()
  })

  it('renders keyMetrics pills for trend format', () => {
    const json = JSON.stringify({
      headline: 'Test',
      keyMetrics: [
        { label: 'Latest', value: 'AED 1,480,000' },
        { label: 'YoY', value: '+12.1%' },
      ],
      analysis: 'Analysis.',
      recommendation: 'Buy.',
    })
    render(<AnalysisBlock text={json} adaptiveFormat="trend" />)
    expect(screen.getByText('AED 1,480,000')).toBeInTheDocument()
    expect(screen.getByText('+12.1%')).toBeInTheDocument()
  })

  it('renders ranking rows for comparison format', () => {
    const json = JSON.stringify({
      headline: 'Noya leads',
      ranking: [
        { rank: 1, name: 'Noya', metric: '+22%', note: 'fastest growth' },
        { rank: 2, name: 'Emaar', metric: '+11%', note: 'steady' },
      ],
      analysis: 'Noya is ahead.',
      recommendation: 'Prefer Noya.',
    })
    render(<AnalysisBlock text={json} adaptiveFormat="comparison" />)
    expect(screen.getByText('Noya')).toBeInTheDocument()
    expect(screen.getByText('+22%')).toBeInTheDocument()
    expect(screen.getByText('Emaar')).toBeInTheDocument()
  })

  it('renders marketData and riskFactors section labels for investment format', () => {
    const json = JSON.stringify({
      headline: 'Yas Island: Strong Buy',
      summary: 'Data supports investment.',
      marketData: 'Prices up 18%.',
      riskFactors: 'Limited supply data.',
      recommendation: 'Buy.',
    })
    render(<AnalysisBlock text={json} adaptiveFormat="investment" />)
    expect(screen.getByText('Market Data')).toBeInTheDocument()
    expect(screen.getByText('Risk Factors')).toBeInTheDocument()
  })

  it('renders factual format with headline and answer', () => {
    const json = JSON.stringify({
      headline: '4,821 transactions in 2024',
      answer: 'There were 4,821 property transactions recorded in Abu Dhabi during 2024.',
    })
    render(<AnalysisBlock text={json} adaptiveFormat="factual" />)
    expect(screen.getByText('4,821 transactions in 2024')).toBeInTheDocument()
  })

  it('renders null text without crashing', () => {
    const { container } = render(<AnalysisBlock text={null} adaptiveFormat="trend" />)
    expect(container.firstChild).toBeNull()
  })

  it('falls back to trend format when adaptiveFormat is unrecognized', () => {
    const json = JSON.stringify({ headline: 'Test headline', analysis: 'Test.' })
    render(<AnalysisBlock text={json} adaptiveFormat="unknown_format" />)
    expect(screen.getByText('Test headline')).toBeInTheDocument()
  })

  it('uses h3 for the headline element', () => {
    const json = JSON.stringify({ headline: 'Test headline', analysis: 'Test.' })
    const { container } = render(<AnalysisBlock text={json} adaptiveFormat="trend" />)
    expect(container.querySelector('h3')).toBeInTheDocument()
    expect(container.querySelector('h3').textContent).toBe('Test headline')
  })

  it('shows rank number badge for ranking items beyond position 3', () => {
    const json = JSON.stringify({
      headline: 'Top districts',
      ranking: [
        { rank: 1, name: 'A', metric: '+30%' },
        { rank: 2, name: 'B', metric: '+20%' },
        { rank: 3, name: 'C', metric: '+15%' },
        { rank: 4, name: 'D', metric: '+10%' },
      ],
      analysis: '',
      recommendation: '',
    })
    render(<AnalysisBlock text={json} adaptiveFormat="comparison" />)
    // rank 4 should show '4' not a bullet
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})
