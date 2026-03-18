import {
  Box, Typography, Card, CardContent, Chip, Button, CircularProgress, Alert,
  Divider,
} from '@mui/material'
import {
  AccountBalance, CurrencyExchange, Speed, TrendingUp,
  Gavel, PlayArrow, CheckCircle,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import StatusBadge from '../components/StatusBadge'
import { getRecommendations, dismissRecommendation, Recommendation } from '../api/bigquery'

const PRIORITY_ORDER = ['HIGH', 'MEDIUM', 'LOW'] as const

const priorityColor = (priority: string): 'error' | 'warning' | 'info' => {
  switch (priority) {
    case 'HIGH': return 'error'
    case 'MEDIUM': return 'warning'
    case 'LOW': return 'info'
    default: return 'info'
  }
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PLACE_DEPOSIT: {
    label: 'Place Term Deposit',
    icon: <AccountBalance fontSize="small" />,
    color: '#0070F2',
  },
  HEDGE_FX: {
    label: 'FX Forward Hedge',
    icon: <CurrencyExchange fontSize="small" />,
    color: '#36A41D',
  },
  ACCELERATE_COLLECTION: {
    label: 'Accelerate Collection',
    icon: <Speed fontSize="small" />,
    color: '#E76500',
  },
  PLACE_INVESTMENT: {
    label: 'Place Investment',
    icon: <TrendingUp fontSize="small" />,
    color: '#7B61FF',
  },
}

const getExecutionPlan = (rec: Recommendation): string[] => {
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: rec.currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(rec.amount)

  switch (rec.action_type) {
    case 'PLACE_DEPOSIT':
      return [
        `Transfer ${amount} from operating account to term deposit`,
        `Deposit placed with Deutsche Bank at ~4.2% annual rate`,
        `Term: 30 days, maturity auto-credited back to operating account`,
        `Confirmation ID and maturity date recorded in execution log`,
      ]
    case 'HEDGE_FX':
      return [
        `Execute FX forward contract: sell ${amount} for USD`,
        `Trade placed with broker at prevailing forward rate`,
        `Settlement in 21 business days`,
        `Locks in exchange rate, eliminating FX risk on this exposure`,
        `Trade confirmation and rate recorded in execution log`,
      ]
    case 'ACCELERATE_COLLECTION':
      return [
        `Flag receivable for immediate follow-up by collections team`,
        `Send automated payment reminder to customer`,
        `Escalate to VP Treasury for direct counterparty engagement`,
        `Monitor payment status daily until resolved`,
      ]
    default:
      return [`Execute ${rec.action_type.replace(/_/g, ' ').toLowerCase()} for ${amount}`]
  }
}

const Recommendations = () => {
  const queryClient = useQueryClient()

  const { data: recommendations = [], isLoading, isError } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => getRecommendations(),
    refetchInterval: 10000,
  })

  const dismissMutation = useMutation({
    mutationFn: (id: string) => dismissRecommendation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  })

  const formatCurrency = (amount: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const grouped = PRIORITY_ORDER.map(priority => ({
    priority,
    items: recommendations.filter((r: Recommendation) => r.priority === priority),
  })).filter(g => g.items.length > 0)

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load recommendations</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Agent Recommendations
      </Typography>

      {recommendations.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No recommendations yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The autonomous agent will generate recommendations during its scheduled runs.
          </Typography>
        </Box>
      ) : (
        grouped.map(({ priority, items }) => (
          <Box key={priority} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Chip
                label={priority}
                color={priorityColor(priority)}
                size="small"
                sx={{ fontWeight: 700 }}
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Priority ({items.length})
              </Typography>
            </Box>

            {items.map((rec: Recommendation) => {
              const actionCfg = ACTION_CONFIG[rec.action_type] || {
                label: rec.action_type.replace(/_/g, ' '),
                icon: <PlayArrow fontSize="small" />,
                color: '#666',
              }
              const executionSteps = getExecutionPlan(rec)

              return (
                <Card
                  key={rec.recommendation_id + rec.created_at}
                  elevation={0}
                  sx={{
                    mb: 2,
                    border: '1px solid #E0E0E0',
                    '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
                  }}
                >
                  <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                    {/* Header: Action type, amount, status */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        <Chip
                          icon={actionCfg.icon as React.ReactElement}
                          label={actionCfg.label}
                          sx={{
                            fontWeight: 600,
                            bgcolor: `${actionCfg.color}14`,
                            color: actionCfg.color,
                            border: `1px solid ${actionCfg.color}40`,
                            '& .MuiChip-icon': { color: actionCfg.color },
                          }}
                        />
                        <Chip
                          label={rec.priority}
                          color={priorityColor(rec.priority)}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                          {formatCurrency(rec.amount, rec.currency)}
                        </Typography>
                      </Box>
                      <StatusBadge status={rec.status as any} />
                    </Box>

                    {/* Description */}
                    <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                      {rec.description}
                    </Typography>

                    {/* Rationale — always visible, never truncated */}
                    <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, borderLeft: '3px solid', borderColor: 'primary.main' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
                        Agent Rationale
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                        {rec.rationale}
                      </Typography>
                    </Box>

                    {/* Execution Plan — what happens if approved */}
                    <Box sx={{ mb: 2, p: 2, bgcolor: '#F0F7FF', borderRadius: 1, borderLeft: '3px solid', borderColor: 'info.main' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'info.dark', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {rec.status === 'AUTO_EXECUTED' ? (
                          <><CheckCircle sx={{ fontSize: 14 }} /> Actions Taken</>
                        ) : (
                          <><Gavel sx={{ fontSize: 14 }} /> Actions Upon Approval</>
                        )}
                      </Typography>
                      <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                        {executionSteps.map((step, i) => (
                          <Typography component="li" variant="body2" key={i} sx={{ mb: 0.5, lineHeight: 1.6 }}>
                            {step}
                          </Typography>
                        ))}
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Footer: metadata and actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatTimestamp(rec.created_at)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                          {rec.recommendation_id}
                        </Typography>
                        {rec.approval_request_id && (
                          <Chip
                            label={`Approval: ${rec.approval_request_id}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            clickable
                            component="a"
                            href="/approvals"
                            sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                          />
                        )}
                      </Box>
                      {rec.status !== 'DISMISSED' && rec.status !== 'AUTO_EXECUTED' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          onClick={() => dismissMutation.mutate(rec.recommendation_id)}
                          disabled={dismissMutation.isPending}
                          sx={{ textTransform: 'none' }}
                        >
                          Dismiss
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              )
            })}
          </Box>
        ))
      )}
    </Box>
  )
}

export default Recommendations
