import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'

const fmt = (v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-medium">AED {Number(payload[0]?.value).toLocaleString()}</p>
      <p className="text-slate-500">{payload[0]?.payload?.tx_count?.toLocaleString()} transactions</p>
    </div>
  )
}

export function MedianPriceChart({ data }) {
  return (
    <ChartCard
      title="Median Sale Price"
      subtitle="Monthly median · AED"
      empty={!data?.length}
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="median_price" stroke="#e94560" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#e94560' }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
