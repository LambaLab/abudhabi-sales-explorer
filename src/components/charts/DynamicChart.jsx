import { MedianPriceChart }      from './MedianPriceChart'
import { PricePerSqmChart }      from './PricePerSqmChart'
import { VolumeChart }           from './VolumeChart'
import { ProjectComparisonChart } from './ProjectComparisonChart'

/**
 * Renders the correct chart component based on the post's queryType.
 * All multi-series types (project_comparison, district_comparison, layout_distribution)
 * use ProjectComparisonChart since they all produce the same pivoted data shape.
 */
export function DynamicChart({ intent, chartData, chartKeys }) {
  const { queryType } = intent ?? {}

  if (queryType === 'rate_trend') {
    return <PricePerSqmChart data={chartData} />
  }
  if (queryType === 'volume_trend') {
    return <VolumeChart data={chartData} />
  }
  if (['project_comparison', 'district_comparison', 'layout_distribution'].includes(queryType)) {
    return <ProjectComparisonChart data={chartData} seriesKeys={chartKeys} />
  }
  // Default: price_trend and anything else
  return <MedianPriceChart data={chartData} />
}
