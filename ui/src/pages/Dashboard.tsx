import { Box, Grid, Card, CardContent, Typography, List, ListItem, ListItemText, Chip, CircularProgress, Alert } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import CashPositionCard from '../components/CashPositionCard'
import CurrencySummaryCard from '../components/CurrencySummaryCard'
import ForecastChart from '../components/ForecastChart'
import ObligationsTable from '../components/ObligationsTable'
import { getCashPosition, getForecast, getObligations, getAuditLog, getRecommendations } from '../api/bigquery'

const CURRENCY_COLORS: Record<string, string> = {
  USD: '#0070F2',
  EUR: '#36A41D',
  GBP: '#E76500',
}

const Dashboard = () => {
  const cashQuery = useQuery({ queryKey: ['cashPosition'], queryFn: getCashPosition })
  const forecastQuery = useQuery({ queryKey: ['forecast'], queryFn: () => getForecast(30) })
  const obligationsQuery = useQuery({ queryKey: ['obligations'], queryFn: getObligations })
  const auditQuery = useQuery({ queryKey: ['auditLog'], queryFn: () => getAuditLog(10) })
  const recQuery = useQuery({ queryKey: ['recommendations'], queryFn: getRecommendations })

  const currencyTotals = cashQuery.data?.currencyTotals ?? []
  const grandTotal = cashQuery.data?.grandTotalUsd ?? 0

  const cashPositions = currencyTotals.map(t => ({
    currency: t.currency,
    balance: t.balance,
    usdEquivalent: t.usdEquivalent,
    changePercent: 0,
  }))

  const currencyBreakdown = currencyTotals.map(t => ({
    currency: t.currency,
    amount: t.usdEquivalent,
    percentage: grandTotal > 0 ? Math.round((t.usdEquivalent / grandTotal) * 1000) / 10 : 0,
    color: CURRENCY_COLORS[t.currency] || '#999',
  }))

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date()
    const then = new Date(timestamp)
    const diffMs = now.getTime() - then.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return `${Math.floor(diffHr / 24)}d ago`
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Treasury Overview
      </Typography>

      {/* Cash Position Cards */}
      {cashQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : cashQuery.isError ? (
        <Alert severity="error" sx={{ mb: 3 }}>Failed to load cash position</Alert>
      ) : (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {cashPositions.map((position) => (
            <Grid item xs={12} md={4} key={position.currency}>
              <CashPositionCard {...position} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Total Summary + Recent Activity */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <CurrencySummaryCard totalUsd={grandTotal} breakdown={currencyBreakdown} />
        </Grid>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Recent Agent Activity
              </Typography>
              {auditQuery.isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
              ) : auditQuery.data && auditQuery.data.length > 0 ? (
                <List dense>
                  {auditQuery.data.map((entry, idx) => (
                    <ListItem
                      key={idx}
                      sx={{
                        borderLeft: '3px solid',
                        borderColor: 'primary.main',
                        mb: 1,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {entry.agent_name}: {entry.action}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {entry.output_summary || entry.input_summary}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatTimeAgo(entry.timestamp)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No agent activity recorded yet. Start a conversation with the agent to see activity here.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Recommendations */}
      {recQuery.data && recQuery.data.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Recent Recommendations
            </Typography>
            <List dense>
              {recQuery.data.slice(0, 3).map((rec) => (
                <ListItem
                  key={rec.recommendation_id}
                  sx={{
                    borderLeft: '3px solid',
                    borderColor:
                      rec.priority === 'HIGH' ? 'error.main' :
                      rec.priority === 'MEDIUM' ? 'warning.main' : 'info.main',
                    mb: 1,
                    bgcolor: 'background.default',
                    borderRadius: 1,
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={rec.priority}
                          size="small"
                          color={rec.priority === 'HIGH' ? 'error' : rec.priority === 'MEDIUM' ? 'warning' : 'info'}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {rec.action_type.replace(/_/g, ' ')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: rec.currency, minimumFractionDigits: 0 }).format(rec.amount)}
                        </Typography>
                      </Box>
                    }
                    secondary={rec.description}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Forecast Chart */}
      <Box sx={{ mb: 3 }}>
        <ForecastChart
          forecasts={forecastQuery.data?.forecasts ?? []}
          isLoading={forecastQuery.isLoading}
          error={forecastQuery.data?.error}
        />
      </Box>

      {/* Obligations Table */}
      <ObligationsTable
        obligations={obligationsQuery.data ?? []}
        isLoading={obligationsQuery.isLoading}
      />
    </Box>
  )
}

export default Dashboard
