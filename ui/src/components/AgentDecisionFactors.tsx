import { Card, CardContent, Typography, Box, Chip, CircularProgress, Divider } from '@mui/material'
import { AccountBalance, CurrencyExchange, Warning } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { getPolicyThresholds } from '../api/bigquery'
import type { Obligation, PaymentRun } from '../api/bigquery'

interface AgentDecisionFactorsProps {
  obligations: Obligation[]
  paymentRuns: PaymentRun[]
  currencyBalances: Record<string, number>
  isLoading: boolean
}

const formatCompact = (amount: number, currency: string): string => {
  const symbol: Record<string, string> = { USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5', CHF: 'CHF ', SGD: 'S$', AUD: 'A$' }
  const s = symbol[currency] || ''
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1000000) return `${sign}${s}${(abs / 1000000).toFixed(1)}M`
  if (abs >= 1000) return `${sign}${s}${(abs / 1000).toFixed(0)}K`
  return `${sign}${s}${abs.toFixed(0)}`
}

const AgentDecisionFactors = ({ obligations, paymentRuns, currencyBalances, isLoading }: AgentDecisionFactorsProps) => {
  const { data: thresholds } = useQuery({
    queryKey: ['policy-thresholds'],
    queryFn: getPolicyThresholds,
    staleTime: Infinity,
  })

  const SURPLUS_RATIO = thresholds?.surplus_ratio ?? 1.2
  const HEDGE_THRESHOLDS: Record<string, number> = thresholds?.hedge_thresholds ?? { EUR: 750000, GBP: 500000, JPY: 50000000, CHF: 500000, SGD: 500000, AUD: 500000 }
  const COLLECTION_RISK_THRESHOLD = thresholds?.collection_risk_probability ?? 0.6

  if (isLoading) {
    return (
      <Card>
        <CardContent sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={24} />
        </CardContent>
      </Card>
    )
  }

  // Compute AP totals by currency
  const apTotalsByCurrency: Record<string, number> = {}
  for (const ob of obligations) {
    if (ob.type === 'AP') {
      apTotalsByCurrency[ob.currency] = (apTotalsByCurrency[ob.currency] || 0) + ob.amount
    }
  }

  // Compute probability-weighted AR totals by currency
  const arWeightedByCurrency: Record<string, number> = {}
  for (const ob of obligations) {
    if (ob.type === 'AR') {
      arWeightedByCurrency[ob.currency] = (arWeightedByCurrency[ob.currency] || 0) + ob.amount * (ob.probability || 1)
    }
  }

  // Payment run totals by currency
  const paymentRunTotals: Record<string, number> = {}
  for (const run of paymentRuns) {
    paymentRunTotals[run.currency] = (paymentRunTotals[run.currency] || 0) + run.total_amount
  }

  // All currencies present
  const allCurrencies = [...new Set([
    ...Object.keys(currencyBalances),
    ...Object.keys(apTotalsByCurrency),
  ])].sort()

  // Collection risk items (AR with probability < 60%)
  const riskyItems = obligations.filter(ob => ob.type === 'AR' && (ob.probability ?? 1) < COLLECTION_RISK_THRESHOLD)
  const riskyTotal = riskyItems.reduce((sum, ob) => sum + ob.amount, 0)

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
          Agent Decision Factors
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Computed metrics and policy thresholds the agent uses to generate recommendations
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          {/* Section A: Surplus Analysis */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <AccountBalance sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                Surplus Analysis
              </Typography>
              <Chip label="PLACE_DEPOSIT" size="small" variant="outlined" sx={{ fontSize: 10 }} />
            </Box>
            <Chip label={`Policy: balance > ${SURPLUS_RATIO * 100}% of obligations`} size="small" variant="outlined" color="info" sx={{ mb: 1.5 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {allCurrencies.map(cur => {
                const balance = currencyBalances[cur] || 0
                const totalObligations = (apTotalsByCurrency[cur] || 0) + (paymentRunTotals[cur] || 0)
                const threshold = SURPLUS_RATIO * totalObligations
                const surplus = balance - threshold
                const isSurplus = surplus > 0

                return (
                  <Box key={cur} sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{cur}</Typography>
                      <Chip
                        label={isSurplus ? `Surplus: ${formatCompact(surplus, cur)}` : `Deficit: ${formatCompact(surplus, cur)}`}
                        size="small"
                        color={isSurplus ? 'success' : 'default'}
                        sx={{ fontWeight: 600, fontSize: 11 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">
                        Balance: {formatCompact(balance, cur)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Threshold: {formatCompact(threshold, cur)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      AP: {formatCompact(apTotalsByCurrency[cur] || 0, cur)} + Payments: {formatCompact(paymentRunTotals[cur] || 0, cur)}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
          <Divider sx={{ display: { xs: 'block', md: 'none' } }} />

          {/* Section B: FX Exposure */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <CurrencyExchange sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                FX Exposure
              </Typography>
              <Chip label="HEDGE_FX" size="small" variant="outlined" sx={{ fontSize: 10 }} />
            </Box>
            <Chip label="Policy: net obligation exceeds threshold" size="small" variant="outlined" color="info" sx={{ mb: 1.5 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {Object.entries(HEDGE_THRESHOLDS).map(([cur, hedgeThreshold]) => {
                const ap = apTotalsByCurrency[cur] || 0
                const arWeighted = arWeightedByCurrency[cur] || 0
                const netObligation = ap - arWeighted
                const exceedsThreshold = netObligation > hedgeThreshold

                return (
                  <Box key={cur} sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{cur}</Typography>
                      <Chip
                        label={exceedsThreshold ? 'Hedge recommended' : 'Below threshold'}
                        size="small"
                        color={exceedsThreshold ? 'warning' : 'default'}
                        sx={{ fontWeight: 600, fontSize: 11 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">
                        Net obligation: {formatCompact(netObligation, cur)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Threshold: {formatCompact(hedgeThreshold, cur)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">
                        AP: {formatCompact(ap, cur)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        AR (wtd): {formatCompact(arWeighted, cur)}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
          <Divider sx={{ display: { xs: 'block', md: 'none' } }} />

          {/* Section C: Collection Risks */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Warning sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                Collection Risks
              </Typography>
              <Chip label="ACCELERATE_COLLECTION" size="small" variant="outlined" sx={{ fontSize: 10 }} />
            </Box>
            <Chip label={`Policy: probability < ${COLLECTION_RISK_THRESHOLD * 100}%`} size="small" variant="outlined" color="info" sx={{ mb: 1.5 }} />
            {riskyItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No high-risk receivables</Typography>
            ) : (
              <>
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                  <Chip label={`${riskyItems.length} items`} size="small" color="error" sx={{ fontWeight: 600 }} />
                  <Chip label={`Total: ${formatCompact(riskyTotal, 'USD')}`} size="small" variant="outlined" color="error" sx={{ fontWeight: 600 }} />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {riskyItems.map(item => (
                    <Box key={item.id} sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.counterparty}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {formatCompact(item.amount, item.currency)}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="error.main">
                        Probability: {((item.probability ?? 1) * 100).toFixed(0)}%
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default AgentDecisionFactors
