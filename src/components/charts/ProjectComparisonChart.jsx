import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'

const COLORS = ['#9266cc','#38bdf8','#a78bfa','#34d399','#fb923c','#f472b6','#facc15','#60a5fa']

const fmt = (v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`

export function ProjectComparisonChart({ data, seriesKeys = [], chartType = 'bar' }) {
  const isEmpty = !data || !Array.isArray(data) || data.length === 0 || !seriesKeys.length

  const commonProps = {
    data,
    margin: { top: 4, right: 8, left: 0, bottom: 0 },
  }
  const xAxis = <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
  const yAxis = <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
  const tooltip = (
    <Tooltip
      formatter={(value, name) => [`AED ${Number(value).toLocaleString()}`, name]}
      contentStyle={{ backgroundColor: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: 6, fontSize: 11, color: 'var(--tooltip-color)' }}
      labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
    />
  )
  const legend = <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />

  return (
    <ChartCard
      title="Project Comparison"
      subtitle={
        seriesKeys.length
          ? `Median price · ${seriesKeys.length} project${seriesKeys.length > 1 ? 's' : ''}`
          : 'Select projects above to compare'
      }
      empty={isEmpty}
    >
      <ResponsiveContainer width="100%" height={260}>
        {chartType === 'bar' ? (
          <BarChart {...commonProps}>
            {xAxis}{yAxis}{tooltip}{legend}
            {seriesKeys.map((project, i) => (
              <Bar key={project} dataKey={project} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} maxBarSize={16} />
            ))}
          </BarChart>
        ) : (
          <LineChart {...commonProps}>
            {xAxis}{yAxis}{tooltip}{legend}
            {seriesKeys.map((project, i) => (
              <Line
                key={project}
                type="monotone"
                dataKey={project}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </ChartCard>
  )
}
