import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'
import { InlineDateRange } from './InlineDateRange'

const COLORS = ['#9266cc', '#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15']

export function DonutChart({ title, subtitle, data, dateRange, onDateRangeChange }) {
  // data: [{ layout: string, tx_count: number }]
  const chartData = data?.map(d => ({ name: d.layout, value: d.tx_count })) ?? []

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={!chartData.length}
      headerRight={dateRange && onDateRangeChange && <InlineDateRange value={dateRange} onChange={onDateRangeChange} />}
    >
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip
            formatter={(v, name) => [Number(v).toLocaleString(), name]}
            contentStyle={{ backgroundColor: 'var(--tooltip-bg, #1e293b)', border: '1px solid var(--tooltip-border, #334155)', borderRadius: 6, fontSize: 11, color: 'var(--tooltip-color, #f1f5f9)' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
