import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'
import { InlineDateRange } from './InlineDateRange'

const fmt = (v) => v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v)

/**
 * Pivots off-plan vs ready rows from the DB into Recharts multi-line format.
 * data: [{ month, sale_type, avg_rate }]
 */
function pivot(rows) {
  if (!rows?.length) return []
  const map = {}
  rows.forEach(r => {
    if (!map[r.month]) map[r.month] = { month: r.month }
    map[r.month][r.sale_type] = r.avg_rate
  })
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
}

export function OffPlanChart({ data, dateRange, onDateRangeChange }) {
  const chartData = pivot(data)
  const series = [...new Set(data?.map(d => d.sale_type) ?? [])]

  return (
    <ChartCard
      title="Off-Plan vs Ready: Price per SQM"
      subtitle="Average AED/sqm by sale type"
      empty={!chartData.length}
      headerRight={dateRange && onDateRangeChange && <InlineDateRange value={dateRange} onChange={onDateRangeChange} />}
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            formatter={(v, name) => [`AED ${Number(v).toLocaleString()}/sqm`, name]}
            contentStyle={{ backgroundColor: 'var(--tooltip-bg, #1e293b)', border: '1px solid var(--tooltip-border, #334155)', borderRadius: 6, fontSize: 11, color: 'var(--tooltip-color, #f1f5f9)' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, i) => (
            <Line key={s} type="monotone" dataKey={s} stroke={i === 0 ? '#9266cc' : '#38bdf8'} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
