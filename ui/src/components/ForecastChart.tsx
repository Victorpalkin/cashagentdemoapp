import React from 'react'
import { Card, CardContent, Typography, Box, CircularProgress, Button } from '@mui/material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ForecastDataPoint, Obligation, PaymentRun } from '../api/bigquery'

interface ForecastChartProps {
  forecasts: ForecastDataPoint[]
  isLoading: boolean
  error?: string
  currentBalances?: Record<string, number>
  obligations?: Obligation[]
  paymentRuns?: PaymentRun[]
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5', CHF: 'CHF ', SGD: 'S$', AUD: 'A$' }

const ForecastChart = ({ forecasts, isLoading, error, currentBalances, obligations = [], paymentRuns = [] }: ForecastChartProps) => {
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

  // Build AR/AP/payment-run adjustments indexed by date+currency
  const adjustmentsByDateCurrency: Record<string, Record<string, number>> = {}
  const addAdjustment = (dateStr: string, currency: string, amount: number) => {
    const dateKey = dateStr.split('T')[0]
    if (!adjustmentsByDateCurrency[dateKey]) adjustmentsByDateCurrency[dateKey] = {}
    adjustmentsByDateCurrency[dateKey][currency] = (adjustmentsByDateCurrency[dateKey][currency] || 0) + amount
  }
  for (const ob of obligations) {
    const dateKey = ob.date.split('T')[0]
    if (ob.type === 'AR') {
      addAdjustment(dateKey, ob.currency, ob.amount * (ob.probability ?? 1))
    } else {
      addAdjustment(dateKey, ob.currency, -ob.amount)
    }
  }
  for (const run of paymentRuns) {
    addAdjustment(run.scheduled_date, run.currency, -run.total_amount)
  }

  // Group forecast data by date, computing cumulative balances per currency
  const chartData = (() => {
    if (!forecasts.length) return []

    const today = new Date().toISOString().split('T')[0]
    const byCurrency: Record<string, { date: string; flow: number }[]> = {}
    for (const f of forecasts) {
      const dateKey = f.forecast_date.split('T')[0]
      if (dateKey <= today) continue
      if (!byCurrency[f.currency]) byCurrency[f.currency] = []
      byCurrency[f.currency].push({ date: dateKey, flow: f.net_cash_flow })
    }

    // Compute cumulative balances: baseline (ML-only) and enriched (ML + AR/AP/payment runs)
    const baselineByCurrency: Record<string, Record<string, number>> = {}
    const enrichedByCurrency: Record<string, Record<string, number>> = {}
    for (const [currency, entries] of Object.entries(byCurrency)) {
      entries.sort((a, b) => a.date.localeCompare(b.date))
      const startBalance = currentBalances?.[currency] ?? 0
      let baselineRunning = startBalance
      let enrichedRunning = startBalance
      baselineByCurrency[currency] = { [today]: startBalance }
      enrichedByCurrency[currency] = { [today]: startBalance }
      for (const entry of entries) {
        baselineRunning += entry.flow
        baselineByCurrency[currency][entry.date] = baselineRunning

        const adj = adjustmentsByDateCurrency[entry.date]?.[currency] || 0
        enrichedRunning += entry.flow + adj
        enrichedByCurrency[currency][entry.date] = enrichedRunning
      }
    }

    // Pivot into chart rows
    const futureDates = [...new Set(forecasts.map(f => f.forecast_date.split('T')[0]).filter(d => d > today))].sort()
    const allDates = [today, ...futureDates]
    return allDates.map(date => {
      const row: Record<string, any> = { date: formatDate(date) }
      for (const currency of Object.keys(baselineByCurrency)) {
        if (baselineByCurrency[currency][date] !== undefined) {
          row[`${currency}_baseline`] = Math.round(baselineByCurrency[currency][date])
        }
        if (enrichedByCurrency[currency][date] !== undefined) {
          row[`${currency}_enriched`] = Math.round(enrichedByCurrency[currency][date])
        }
      }
      return row
    })
  })()

  const allCurrencies = [...new Set(forecasts.map(f => f.currency))].sort()
  const colorMap: Record<string, string> = { USD: '#0070F2', EUR: '#36A41D', GBP: '#E76500', JPY: '#CC1919', CHF: '#7B61FF', SGD: '#00B4D8', AUD: '#F77F00' }
  const defaultCurrencies = ['USD', 'EUR', 'GBP']
  const [showAllCurrencies, setShowAllCurrencies] = React.useState(false)
  const currencies = showAllCurrencies ? allCurrencies : allCurrencies.filter(c => defaultCurrencies.includes(c))

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
          30-Day Cash Forecast
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            Agent-enriched projection (solid) adjusted for probability-weighted AR, scheduled AP, and payment runs vs. ML-only baseline (dashed)
          </Typography>
          {allCurrencies.length > 3 && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setShowAllCurrencies(!showAllCurrencies)}
              sx={{ textTransform: 'none', ml: 2, whiteSpace: 'nowrap' }}
            >
              {showAllCurrencies ? 'Show Major' : `Show All (${allCurrencies.length})`}
            </Button>
          )}
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : error ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Forecast not available. Run the model creation notebook to enable forecasting.
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
                  key={`${cur}_enriched`}
                  type="monotone"
                  dataKey={`${cur}_enriched`}
                  stroke={colorMap[cur] || '#999'}
                  strokeWidth={2.5}
                  dot={false}
                  name={`${cur} Agent-Enriched`}
                />
              ))}
              {currencies.map(cur => (
                <Line
                  key={`${cur}_baseline`}
                  type="monotone"
                  dataKey={`${cur}_baseline`}
                  stroke={colorMap[cur] || '#999'}
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                  name={`${cur} ML Baseline`}
                  opacity={0.6}
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
