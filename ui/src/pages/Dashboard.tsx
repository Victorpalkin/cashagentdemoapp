import { Box, Grid, Card, CardContent, Typography, List, ListItem, ListItemText, Chip, CircularProgress, Alert, Button, Snackbar, Collapse, IconButton } from '@mui/material'
import { SmartToy, ExpandMore, Info } from '@mui/icons-material'
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

  const [guideOpen, setGuideOpen] = useState(false)
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
    accounts: t.accounts ?? [],
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

      {/* Dashboard Guide */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setGuideOpen(!guideOpen)}
          >
            <Info sx={{ color: 'primary.main', mr: 1 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
              Dashboard Guide
            </Typography>
            <IconButton size="small">
              <ExpandMore
                sx={{
                  transform: guideOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </IconButton>
          </Box>
          <Collapse in={guideOpen}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {[
                {
                  title: 'Cash Position Cards',
                  desc: 'Shows the current real-time balance for each currency (USD, EUR, GBP) held across all bank accounts. Each card displays the native currency balance, its USD equivalent, and a daily percentage change indicator so treasury managers can spot significant balance movements at a glance.',
                },
                {
                  title: 'Currency Summary',
                  desc: 'Aggregates the total portfolio value in USD and visualizes the allocation across currencies as a proportional breakdown. Helps assess concentration risk and whether the currency mix aligns with operational needs and hedging targets.',
                },
                {
                  title: 'FX Rates',
                  desc: 'Displays live foreign exchange rates for the currency pairs relevant to the treasury (EUR/USD, GBP/USD, etc.). Provides context for evaluating cross-currency transfers, FX hedge timing, and the USD-equivalent valuations shown elsewhere on the dashboard.',
                },
                {
                  title: 'Anomaly Detection',
                  desc: 'Summarizes anomalies flagged by the AI anomaly detection agent. These include unusual transaction patterns, unexpected cash flow deviations, low-probability receivables, and unmatched payments that may require investigation or corrective action.',
                },
                {
                  title: 'Agent Decision Factors',
                  desc: 'Shows the key data points and metrics the AI agent weighs when generating recommendations: upcoming obligations, net cash flow per currency, liquidity coverage ratios, and payment run impacts. Provides transparency into the agent\'s reasoning process.',
                },
                {
                  title: 'Scheduled Payment Runs',
                  desc: 'Lists upcoming scheduled payment obligations such as payroll, tax remittances, pension contributions, and social security — distinct from vendor AP items. Shows the run description, total amount, currency, scheduled date, and number of line items.',
                },
                {
                  title: 'Recent Agent Activity',
                  desc: 'A chronological feed of the latest actions taken by the autonomous AI agents, including analysis runs, recommendations generated, and executions performed. Each entry shows the agent name, action type, summary, and timestamp.',
                },
                {
                  title: 'Recent Recommendations',
                  desc: 'Displays the most recent AI-generated treasury recommendations (e.g., intercompany transfers, FX hedges, term deposits, collection acceleration) with priority levels (HIGH/MEDIUM/LOW), amounts, and descriptions. The agent may recommend converting surplus currency (e.g. EUR) to cover shortfalls in others (e.g. USD). High-priority items may require approval before execution.',
                },
                {
                  title: 'Cash Flow Forecast',
                  desc: 'A 30-day forward-looking chart powered by Google\'s TimesFM AI forecasting model. Shows projected cash positions per currency, overlaid with known obligations and payment runs. Some currencies (e.g. EUR, CHF) may trend upward while others (e.g. USD, GBP) decline — revealing cross-currency rebalancing opportunities.',
                },
                {
                  title: 'Obligations Table',
                  desc: 'A detailed table of all upcoming accounts payable (AP) and accounts receivable (AR) with counterparty names, amounts, currencies, due dates, and probability scores. Provides the granular data behind the forecast and helps identify collection risks or payment scheduling opportunities.',
                },
              ].map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item.title}>
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.default', height: '100%' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                      {item.desc}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

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
