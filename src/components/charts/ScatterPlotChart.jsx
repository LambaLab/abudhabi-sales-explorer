import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts'
import { ChartCard } from './ChartCard'
import { InlineDateRange } from './InlineDateRange'

const fmt = (v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`

export function ScatterPlotChart({ title, subtitle, data, dateRange, onDateRangeChange }) {
  // data: [{ area_sqm, price_aed, project_name }]
  const chartData = data?.map(d => ({ x: d.area_sqm, y: d.price_aed })) ?? []

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={!chartData.length}
      headerRight={dateRange && onDateRangeChange && <InlineDateRange value={dateRange} onChange={onDateRangeChange} />}
    >
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis type="number" dataKey="x" name="Area (sqm)" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} label={{ value: 'Area (sqm)', position: 'insideBottom', dy: 12, fontSize: 10, fill: '#64748b' }} />
          <YAxis type="number" dataKey="y" name="Price (AED)" tickFormatter={fmt} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
          <ZAxis range={[10, 10]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs">
                  <p className="text-white">Area: {payload[0]?.value?.toLocaleString()} sqm</p>
                  <p className="text-white">Price: AED {payload[1]?.value?.toLocaleString()}</p>
                </div>
              )
            }}
          />
          <Scatter data={chartData} fill="#e94560" fillOpacity={0.4} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
