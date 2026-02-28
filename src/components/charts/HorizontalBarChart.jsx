import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ChartCard } from './ChartCard'
import { InlineDateRange } from './InlineDateRange'

const ACCENT = '#9266cc'
const fmt = (v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v)

/**
 * Generic horizontal bar chart.
 * data: [{ label: string, value: number }]
 */
export function HorizontalBarChart({ title, subtitle, data, valueLabel = '', dateRange, onDateRangeChange }) {
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={!data?.length}
      headerRight={dateRange && onDateRangeChange && <InlineDateRange value={dateRange} onChange={onDateRangeChange} />}
    >
      <ResponsiveContainer width="100%" height={Math.max(200, (data?.length ?? 10) * 28)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 48, left: 0, bottom: 0 }}
        >
          <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v) => [`${valueLabel}${Number(v).toLocaleString()}`, '']}
            contentStyle={{ backgroundColor: 'var(--tooltip-bg, #1e293b)', border: '1px solid var(--tooltip-border, #334155)', borderRadius: 6, fontSize: 11, color: 'var(--tooltip-color, #f1f5f9)' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data?.map((_, i) => <Cell key={i} fill={i === 0 ? ACCENT : '#6366f1'} fillOpacity={Math.max(0.5, 1 - i * 0.04)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
