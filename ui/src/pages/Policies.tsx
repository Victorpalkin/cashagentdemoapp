import {
  Box, Typography, Card, CardContent, CircularProgress, Alert,
  Accordion, AccordionSummary, AccordionDetails, Chip, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material'
import { ExpandMore, Shield, CurrencyExchange, AccountBalance } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getPolicies, type PolicyDocument } from '../api/bigquery'

const formatAmount = (amount: number, currency?: string): string => {
  if (amount >= 1000000) return `${currency || ''}${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `${currency || ''}${(amount / 1000).toFixed(0)}K`
  return `${currency || ''}${amount.toLocaleString()}`
}

const ApprovalMatrixCard = ({ thresholds }: { thresholds: Record<string, any> }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Shield color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Approval Matrix</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ p: 1.5, bgcolor: 'success.50', borderRadius: 1, borderLeft: '3px solid', borderColor: 'success.main' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Auto-Execute</Typography>
          <Typography variant="body2" color="text.secondary">
            Up to ${formatAmount(thresholds.agent_auto_execute_max || 100000)}
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, bgcolor: 'warning.50', borderRadius: 1, borderLeft: '3px solid', borderColor: 'warning.main' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>User Confirmation</Typography>
          <Typography variant="body2" color="text.secondary">
            ${formatAmount(thresholds.agent_auto_execute_max || 100000)} &ndash; ${formatAmount(thresholds.agent_confirmation_max || 500000)}
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, bgcolor: 'error.50', borderRadius: 1, borderLeft: '3px solid', borderColor: 'error.main' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Formal VP Approval</Typography>
          <Typography variant="body2" color="text.secondary">
            Above ${formatAmount(thresholds.agent_formal_approval_min || 500000)}
          </Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
)

const HedgingThresholdsCard = ({ thresholds }: { thresholds: Record<string, any> }) => {
  const hedgeThresholds = thresholds.hedge_thresholds || {}
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CurrencyExchange color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>FX Hedging Thresholds</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Mandatory hedge when net exposure exceeds:
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Currency</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Threshold</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(hedgeThresholds).map(([cur, amount]) => (
                <TableRow key={cur}>
                  <TableCell>{cur}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {(amount as number).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {thresholds.hedge_ratio_min != null && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Required hedge ratio: {(thresholds.hedge_ratio_min * 100).toFixed(0)}%&ndash;{(thresholds.hedge_ratio_max * 100).toFixed(0)}%
            &nbsp;&middot;&nbsp;Max tenor: {thresholds.max_hedge_tenor_days} days
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

const TreasuryPolicyCard = ({ thresholds }: { thresholds: Record<string, any> }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AccountBalance color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Treasury Policy</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Surplus Ratio</Typography>
            <Chip label={`${((thresholds.surplus_ratio || 1.2) * 100).toFixed(0)}%`} size="small" color="primary" />
          </Box>
          <Typography variant="caption" color="text.secondary">
            Balance must exceed this % of 30-day obligations to be considered surplus
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Collection Risk</Typography>
            <Chip label={`< ${((thresholds.collection_risk_probability || 0.6) * 100).toFixed(0)}%`} size="small" color="warning" />
          </Box>
          <Typography variant="caption" color="text.secondary">
            AR items below this probability are flagged as collection risks
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Strategic Reserve</Typography>
            <Chip label={`$${formatAmount(thresholds.strategic_reserve_usd || 2000000)}`} size="small" variant="outlined" />
          </Box>
          <Typography variant="caption" color="text.secondary">
            Minimum USD equivalent maintained across all currencies
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Max Counterparty</Typography>
            <Chip label={`${((thresholds.max_counterparty_pct || 0.6) * 100).toFixed(0)}%`} size="small" variant="outlined" />
          </Box>
          <Typography variant="caption" color="text.secondary">
            Maximum % of total cash with any single bank
          </Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
)

const Policies = () => {
  const { data: policies = [], isLoading, isError } = useQuery({
    queryKey: ['policies'],
    queryFn: getPolicies,
    staleTime: Infinity,
  })

  // Merge all thresholds for the summary cards
  const mergedThresholds: Record<string, any> = {}
  for (const doc of policies) {
    Object.assign(mergedThresholds, doc.thresholds)
  }

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
        <Alert severity="error">Failed to load policy documents</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Treasury Policies
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Policy documents and thresholds that govern agent decision-making
      </Typography>

      {/* Key Thresholds Summary */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3, mb: 4 }}>
        <ApprovalMatrixCard thresholds={mergedThresholds} />
        <HedgingThresholdsCard thresholds={mergedThresholds} />
        <TreasuryPolicyCard thresholds={mergedThresholds} />
      </Box>

      {/* Full Policy Documents */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Full Policy Documents
      </Typography>
      {policies.map((doc: PolicyDocument) => (
        <Accordion key={doc.name} defaultExpanded={false} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography sx={{ fontWeight: 600 }}>{doc.display_name}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{
              '& h1': { fontSize: '1.5rem', fontWeight: 700, mt: 2, mb: 1 },
              '& h2': { fontSize: '1.2rem', fontWeight: 600, mt: 2, mb: 1 },
              '& h3': { fontSize: '1rem', fontWeight: 600, mt: 1.5, mb: 0.5 },
              '& p': { mb: 1, lineHeight: 1.7 },
              '& ul, & ol': { mb: 1, pl: 3 },
              '& li': { mb: 0.5 },
              '& table': { width: '100%', borderCollapse: 'collapse', mb: 2 },
              '& th, & td': { border: '1px solid #E0E0E0', p: 1, textAlign: 'left', fontSize: '0.875rem' },
              '& th': { bgcolor: '#F5F5F5', fontWeight: 600 },
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {doc.body_markdown}
              </ReactMarkdown>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  )
}

export default Policies
