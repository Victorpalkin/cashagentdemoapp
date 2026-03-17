import { Card, CardContent, Typography, Box, CircularProgress } from '@mui/material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ForecastDataPoint } from '../api/bigquery'

interface ForecastChartProps {
  forecasts: ForecastDataPoint[]
  isLoading: boolean
  error?: string
}

const ForecastChart = ({ forecasts, isLoading, error }: ForecastChartProps) => {
  const minimumReserve = 8000000

  const formatYAxis = (value: number) => {
    return `$${(value / 1000000).toFixed(1)}M`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Group forecast data by date, pivoting currencies into columns
  const chartData = (() => {
    if (!forecasts.length) return []

    const dateMap: Record<string, Record<string, number>> = {}
    for (const f of forecasts) {
      const dateKey = f.forecast_date.split('T')[0]
      if (!dateMap[dateKey]) dateMap[dateKey] = { dateRaw: Date.parse(dateKey) as unknown as number }
      dateMap[dateKey][f.currency] = f.net_cash_flow
      dateMap[dateKey][`${f.currency}_high`] = f.upper_bound
      dateMap[dateKey][`${f.currency}_low`] = f.lower_bound
    }

    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date: formatDate(date),
        ...values,
      }))
  })()

  const currencies = [...new Set(forecasts.map(f => f.currency))].sort()
  const colorMap: Record<string, string> = { USD: '#0070F2', EUR: '#36A41D', GBP: '#E76500' }

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
          30-Day Cash Forecast
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : error ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              BQML forecast model not available. Run the model creation notebook to enable forecasting.
            </Typography>
          </Box>
        ) : chartData.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No forecast data available</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} interval={4} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
              <Tooltip
                formatter={(value: number) => `$${value.toLocaleString()}`}
                contentStyle={{ borderRadius: 8, border: '1px solid #E0E0E0' }}
              />
              <Legend wrapperStyle={{ paddingTop: 20 }} iconType="line" />

              <ReferenceLine
                y={minimumReserve}
                stroke="#CC1919"
                strokeDasharray="5 5"
                label={{ value: 'Min Reserve', position: 'right', fill: '#CC1919', fontSize: 12 }}
              />

              {currencies.map(cur => (
                <Line
                  key={cur}
                  type="monotone"
                  dataKey={cur}
                  stroke={colorMap[cur] || '#999'}
                  strokeWidth={2}
                  dot={false}
                  name={`${cur} Forecast`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export default ForecastChart
