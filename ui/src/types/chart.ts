export interface ChartData {
  type: 'line' | 'bar' | 'pie'
  title: string
  data: Record<string, string | number>[]
  config: {
    xKey?: string
    yKeys?: string[]
    dataKey?: string
    nameKey?: string
    colors?: Record<string, string>
  }
}
