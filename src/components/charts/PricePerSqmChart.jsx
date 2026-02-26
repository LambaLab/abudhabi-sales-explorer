import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'

const fmt = (v) => `${(v / 1_000).toFixed(0)}K`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="border rounded px-3 py-2 text-xs" style={{ backgroundColor: 'var(--tooltip-bg)', borderColor: 'var(--tooltip-border)', color: 'var(--tooltip-color)' }}>
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-medium">AED {Number(payload[0]?.value).toLocaleString()} / sqm</p>
      <p className="text-slate-500">{payload[0]?.payload?.tx_count?.toLocaleString()} transactions</p>
    </div>
  )
}

export function PricePerSqmChart({ data, chartType = 'bar' }) {
  const commonProps = {
    data,
    margin: { top: 4, right: 8, left: 0, bottom: 0 },
  }
  const xAxis = <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
  const yAxis = <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
  const tooltip = <Tooltip content={<CustomTooltip />} />

  return (
    <ChartCard title="Price per SQM" subtitle="Monthly median · AED/sqm" empty={!data?.length}>
      <ResponsiveContainer width="100%" height={220}>
        {chartType === 'bar' ? (
          <BarChart {...commonProps}>
            {xAxis}{yAxis}{tooltip}
            <Bar dataKey="median_rate" fill="#38bdf8" radius={[2, 2, 0, 0]} maxBarSize={20} />
          </BarChart>
        ) : (
          <LineChart {...commonProps}>
            {xAxis}{yAxis}{tooltip}
            <Line type="monotone" dataKey="median_rate" stroke="#38bdf8" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#38bdf8' }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </ChartCard>
  )
}
