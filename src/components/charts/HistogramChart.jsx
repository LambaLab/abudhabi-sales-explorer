import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'
import { InlineDateRange } from './InlineDateRange'

const fmt = (v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v)

/**
 * Histogram chart. data: [{ bucket_start: number, count: number }]
 * bucketLabel: fn(bucket_start) → display string
 */
export function HistogramChart({ title, subtitle, data, bucketLabel, dateRange, onDateRangeChange }) {
  const chartData = data?.map(d => ({
    label: bucketLabel ? bucketLabel(d.bucket_start) : fmt(d.bucket_start),
    count: d.count,
  })) ?? []

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={!chartData.length}
      headerRight={dateRange && onDateRangeChange && <InlineDateRange value={dateRange} onChange={onDateRangeChange} />}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} angle={-30} textAnchor="end" interval={2} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            formatter={(v) => [Number(v).toLocaleString(), 'transactions']}
            contentStyle={{ backgroundColor: 'var(--tooltip-bg, #1e293b)', border: '1px solid var(--tooltip-border, #334155)', borderRadius: 6, fontSize: 11, color: 'var(--tooltip-color, #f1f5f9)' }}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
