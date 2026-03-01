import { MedianPriceChart }       from './MedianPriceChart'
import { PricePerSqmChart }       from './PricePerSqmChart'
import { VolumeChart }            from './VolumeChart'
import { ProjectComparisonChart } from './ProjectComparisonChart'

/**
 * Renders the correct chart component based on the post's queryType.
 * chartType ('bar' | 'line') is forwarded to trend/comparison charts.
 */
export function DynamicChart({ intent, chartData, chartKeys, chartType = 'bar' }) {
  const { queryType } = intent ?? {}

  if (queryType === 'rate_trend') {
    return <PricePerSqmChart data={chartData} chartType={chartType} />
  }
  if (queryType === 'volume_trend') {
    return <VolumeChart data={chartData} chartType={chartType} />
  }
  if (['project_comparison', 'district_comparison', 'layout_distribution'].includes(queryType)) {
    return <ProjectComparisonChart data={chartData} seriesKeys={chartKeys} chartType={chartType} />
  }
  // Default: price_trend and anything else
  return <MedianPriceChart data={chartData} chartType={chartType} />
}
