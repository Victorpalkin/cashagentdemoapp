import { Card, CardContent, Typography, Box, CircularProgress } from '@mui/material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ForecastDataPoint } from '../api/bigquery'

interface ForecastChartProps {
  forecasts: ForecastDataPoint[]
  isLoading: boolean
  error?: string
  currentBalances?: Record<string, number>
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '\u20AC', GBP: '\u00A3' }

const ForecastChart = ({ forecasts, isLoading, error, currentBalances }: ForecastChartProps) => {
  const minimumReserve = 8000000

  const formatYAxis = (value: number) => {
    const sign = value < 0 ? '-' : ''
    const abs = Math.abs(value)
    if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(0)}K`
    return `${sign}$${abs.toFixed(0)}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Group forecast data by date, computing cumulative balances per currency
  const chartData = (() => {
    if (!forecasts.length) return []

    // Sort forecasts by currency then date
    const byCurrency: Record<string, { date: string; flow: number }[]> = {}
    for (const f of forecasts) {
      const dateKey = f.forecast_date.split('T')[0]
      if (!byCurrency[f.currency]) byCurrency[f.currency] = []
      byCurrency[f.currency].push({ date: dateKey, flow: f.net_cash_flow })
    }

    // Compute cumulative balances
    const cumulativeByCurrency: Record<string, Record<string, number>> = {}
    for (const [currency, entries] of Object.entries(byCurrency)) {
      entries.sort((a, b) => a.date.localeCompare(b.date))
      let running = currentBalances?.[currency] ?? 0
      cumulativeByCurrency[currency] = {}
      for (const entry of entries) {
        running += entry.flow
        cumulativeByCurrency[currency][entry.date] = running
      }
    }

    // Pivot into chart rows
    const allDates = [...new Set(forecasts.map(f => f.forecast_date.split('T')[0]))].sort()
    return allDates.map(date => {
      const row: Record<string, any> = { date: formatDate(date) }
      for (const currency of Object.keys(cumulativeByCurrency)) {
        if (cumulativeByCurrency[currency][date] !== undefined) {
          row[currency] = Math.round(cumulativeByCurrency[currency][date])
        }
      }
      return row
    })
  })()

  const currencies = [...new Set(forecasts.map(f => f.currency))].sort()
  const colorMap: Record<string, string> = { USD: '#0070F2', EUR: '#36A41D', GBP: '#E76500' }

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
          30-Day Projected Cash Balance
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
                formatter={(value: number, name: string) => {
                  const cur = name.split(' ')[0]
                  const symbol = CURRENCY_SYMBOLS[cur] || '$'
                  return `${symbol}${value.toLocaleString()}`
                }}
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
                  name={`${cur} Balance`}
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
