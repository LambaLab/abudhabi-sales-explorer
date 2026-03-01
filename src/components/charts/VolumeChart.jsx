import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="border rounded px-3 py-2 text-xs" style={{ backgroundColor: 'var(--tooltip-bg)', borderColor: 'var(--tooltip-border)', color: 'var(--tooltip-color)' }}>
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-medium">{Number(payload[0]?.value).toLocaleString()} transactions</p>
    </div>
  )
}

export function VolumeChart({ data, chartType = 'bar' }) {
  const common = { data, margin: { top: 4, right: 8, left: 0, bottom: 0 } }
  const xAxis  = <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
  const yAxis  = <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={40} />
  const tooltip = <Tooltip content={<CustomTooltip />} />

  return (
    <ChartCard title="Transaction Volume" subtitle="Number of sales per month" empty={!data?.length}>
      <ResponsiveContainer width="100%" height={180}>
        {chartType === 'line' ? (
          <LineChart {...common}>
            {xAxis}{yAxis}{tooltip}
            <Line type="monotone" dataKey="tx_count" stroke="#9266cc" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#9266cc' }} />
          </LineChart>
        ) : (
          <BarChart {...common}>
            {xAxis}{yAxis}{tooltip}
            <Bar dataKey="tx_count" fill="#9266cc" radius={[2, 2, 0, 0]} maxBarSize={16} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartCard>
  )
}
