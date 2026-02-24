import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'
import { COLORS } from '../ProjectSearch'

const fmt = (v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`

export function ProjectComparisonChart({ data, projects }) {
  const isEmpty = !data || !Array.isArray(data) || data.length === 0 || !projects.length

  return (
    <ChartCard
      title="Project Comparison"
      subtitle={
        projects.length
          ? `Median price · ${projects.length} project${projects.length > 1 ? 's' : ''}`
          : 'Select projects above to compare'
      }
      empty={isEmpty}
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            formatter={(value, name) => [`AED ${Number(value).toLocaleString()}`, name]}
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          {projects.map((project, i) => (
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
      </ResponsiveContainer>
    </ChartCard>
  )
}
