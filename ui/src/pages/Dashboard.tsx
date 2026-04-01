import { Box, Grid, Card, CardContent, Typography, List, ListItem, ListItemText, Chip, CircularProgress, Alert, Button, Snackbar } from '@mui/material'
import { SmartToy } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import CashPositionCard from '../components/CashPositionCard'
import CurrencySummaryCard from '../components/CurrencySummaryCard'
import FxRatesCard from '../components/FxRatesCard'
import ForecastChart from '../components/ForecastChart'
import ObligationsTable from '../components/ObligationsTable'
import AgentDecisionFactors from '../components/AgentDecisionFactors'
import AnomalySummaryCard from '../components/AnomalySummaryCard'
import { getCashPosition, getForecast, getObligations, getAuditLog, getRecommendations, getPaymentRuns, runDailyReview } from '../api/bigquery'
import { useState } from 'react'

const CURRENCY_COLORS: Record<string, string> = {
  USD: '#0070F2',
  EUR: '#36A41D',
  GBP: '#E76500',
  JPY: '#CC1919',
  CHF: '#7B61FF',
  SGD: '#00B4D8',
  AUD: '#F77F00',
}

const Dashboard = () => {
  const queryClient = useQueryClient()
  const cashQuery = useQuery({ queryKey: ['cashPosition'], queryFn: getCashPosition })
  const forecastQuery = useQuery({ queryKey: ['forecast'], queryFn: () => getForecast(30) })
  const obligationsQuery = useQuery({ queryKey: ['obligations'], queryFn: getObligations })
  const auditQuery = useQuery({ queryKey: ['auditLog'], queryFn: () => getAuditLog(10) })
  const recQuery = useQuery({ queryKey: ['recommendations'], queryFn: getRecommendations })
  const paymentRunsQuery = useQuery({ queryKey: ['paymentRuns'], queryFn: getPaymentRuns })

  const [reviewSnackbar, setReviewSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  })

  const reviewMutation = useMutation({
    mutationFn: runDailyReview,
    onSuccess: (data) => {
      queryClient.invalidateQueries()
      const recCount = data.recommendations_created || 0
      setReviewSnackbar({
        open: true,
        message: `Agent review complete: ${recCount} recommendation${recCount !== 1 ? 's' : ''} created`,
        severity: data.errors?.length ? 'error' : 'success',
      })
    },
    onError: (err: Error) => {
      setReviewSnackbar({ open: true, message: `Review failed: ${err.message}`, severity: 'error' })
    },
  })

  const currencyTotals = cashQuery.data?.currencyTotals ?? []
  const grandTotal = cashQuery.data?.grandTotalUsd ?? 0

  const cashPositions = currencyTotals.map(t => ({
    currency: t.currency,
    balance: t.balance,
    usdEquivalent: t.usdEquivalent,
    changePercent: t.changePercent ?? 0,
  }))

  const currencyBreakdown = currencyTotals.map(t => ({
    currency: t.currency,
    amount: t.usdEquivalent,
    percentage: grandTotal > 0 ? Math.round((t.usdEquivalent / grandTotal) * 1000) / 10 : 0,
    color: CURRENCY_COLORS[t.currency] || '#999',
  }))

  // Current balances by currency for cumulative forecast
  const currentBalances: Record<string, number> = {}
  for (const t of currencyTotals) {
    currentBalances[t.currency] = t.balance
  }

  const obligations = obligationsQuery.data ?? []

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

  const formatCompact = (amount: number, currency: string): string => {
    const symbol: Record<string, string> = { USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5', CHF: 'CHF ', SGD: 'S$', AUD: 'A$' }
    const s = symbol[currency] || ''
    if (amount >= 1000000) return `${s}${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${s}${(amount / 1000).toFixed(0)}K`
    return `${s}${amount.toFixed(0)}`
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Treasury Overview
        </Typography>
        <Button
          variant="contained"
          startIcon={reviewMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <SmartToy />}
          onClick={() => reviewMutation.mutate()}
          disabled={reviewMutation.isPending}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {reviewMutation.isPending ? 'Running...' : 'Execute Agents Synchronously Now'}
        </Button>
      </Box>

      {/* Cash Position Cards */}
      {cashQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : cashQuery.isError ? (
        <Alert severity="error" sx={{ mb: 3 }}>Failed to load cash position</Alert>
      ) : (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {cashPositions.map((position) => (
            <Grid item xs={12} sm={6} md={3} key={position.currency}>
              <CashPositionCard {...position} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Total Summary + FX Rates */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <CurrencySummaryCard totalUsd={grandTotal} breakdown={currencyBreakdown} />
        </Grid>
        <Grid item xs={12} md={4}>
          <FxRatesCard />
        </Grid>
        <Grid item xs={12} md={4}>
          <AnomalySummaryCard />
        </Grid>
      </Grid>

      {/* Agent Decision Factors */}
      <Box sx={{ mb: 3 }}>
        <AgentDecisionFactors
          obligations={obligations}
          paymentRuns={paymentRunsQuery.data ?? []}
          currencyBalances={currentBalances}
          isLoading={obligationsQuery.isLoading || paymentRunsQuery.isLoading || cashQuery.isLoading}
        />
      </Box>

      {/* Payment Runs + Recent Activity */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                Scheduled Payment Runs
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Upcoming batch payment runs from SAP
              </Typography>
              {paymentRunsQuery.isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
              ) : !paymentRunsQuery.data || paymentRunsQuery.data.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No scheduled payment runs</Typography>
              ) : (
                <List dense disablePadding>
                  {paymentRunsQuery.data.slice(0, 4).map((run) => (
                    <ListItem
                      key={run.payment_run_id}
                      sx={{ px: 0, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {run.description}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {formatCompact(run.total_amount, run.currency)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {new Date(run.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' \u00B7 '}{run.item_count} items
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                Recent Agent Activity
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Latest actions from autonomous agent runs
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
                        borderColor: entry.action === 'EXECUTE' ? 'success.main' : 'primary.main',
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
                  No agent activity recorded yet. Click "Execute Agents Synchronously Now" to start.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Recommendations */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            Recent Recommendations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Agent-generated recommendations from the most recent review
          </Typography>
          {recQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
          ) : !recQuery.data || recQuery.data.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No recommendations yet. Run the agent review to generate recommendations.
            </Typography>
          ) : (
            <List dense>
              {recQuery.data.slice(0, 5).map((rec) => (
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
          )}
        </CardContent>
      </Card>

      {/* Forecast Chart */}
      <Box sx={{ mb: 3 }}>
        <ForecastChart
          forecasts={forecastQuery.data?.forecasts ?? []}
          isLoading={forecastQuery.isLoading}
          error={forecastQuery.data?.error}
          currentBalances={currentBalances}
          obligations={obligationsQuery.data ?? []}
          paymentRuns={paymentRunsQuery.data ?? []}
        />
      </Box>

      {/* Obligations Table */}
      <ObligationsTable
        obligations={obligationsQuery.data ?? []}
        isLoading={obligationsQuery.isLoading}
      />

      {/* Review Snackbar */}
      <Snackbar
        open={reviewSnackbar.open}
        autoHideDuration={6000}
        onClose={() => setReviewSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={reviewSnackbar.severity} onClose={() => setReviewSnackbar(s => ({ ...s, open: false }))}>
          {reviewSnackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default Dashboard
