import { ChartTab } from '../components/ChartTab'

export default function ChartsPage({ ctx }) {
  const { meta, settings } = ctx
  return (
    <main className="flex-1 overflow-y-auto">
      <ChartTab meta={meta} defaultDateRange={settings.defaultDateRange} />
    </main>
  )
}
