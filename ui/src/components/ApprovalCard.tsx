import { Card, CardContent, Typography, Box, Button, Chip, Divider } from '@mui/material'
import {
  CheckCircle, Cancel, AccountBalance, CurrencyExchange, Speed,
  PlayArrow, Gavel,
} from '@mui/icons-material'

interface ApprovalCardProps {
  requestId: string
  actionType: string
  amount: number
  currency: string
  description: string
  reasoning: string
  timestamp: string
  onApprove: (requestId: string) => void
  onReject: (requestId: string) => void
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
}

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

const getExecutionPlan = (actionType: string, amount: number, currency: string): string[] => {
  const formatted = formatCurrency(amount, currency)
  switch (actionType) {
    case 'PLACE_DEPOSIT':
      return [
        `Transfer ${formatted} from operating account to term deposit`,
        `Deposit placed with Deutsche Bank at ~4.2% annual rate`,
        `Term: 30 days, maturity auto-credited back to operating account`,
        `Confirmation ID and maturity date recorded in execution log`,
      ]
    case 'HEDGE_FX':
      return [
        `Execute FX forward contract: sell ${formatted} for USD`,
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
      return [`Execute ${actionType.replace(/_/g, ' ').toLowerCase()} for ${formatted}`]
  }
}

const ApprovalCard = ({
  requestId,
  actionType,
  amount,
  currency,
  description,
  reasoning,
  timestamp,
  onApprove,
  onReject,
}: ApprovalCardProps) => {
  const actionCfg = ACTION_CONFIG[actionType] || {
    label: actionType.replace(/_/g, ' '),
    icon: <PlayArrow fontSize="small" />,
    color: '#666',
  }
  const executionSteps = getExecutionPlan(actionType, amount, currency)

  return (
    <Card sx={{ mb: 2, border: '2px solid', borderColor: 'warning.main' }}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        {/* Header */}
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
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {formatCurrency(amount, currency)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Chip label="PENDING APPROVAL" color="warning" size="small" sx={{ fontWeight: 600 }} />
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              {formatTimestamp(timestamp)}
            </Typography>
          </Box>
        </Box>

        {/* Description */}
        <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
          {description}
        </Typography>

        {/* Reasoning — full text, never truncated */}
        <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, borderLeft: '3px solid', borderColor: 'primary.main' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
            Agent Reasoning
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {reasoning}
          </Typography>
        </Box>

        {/* Execution Plan */}
        <Box sx={{ mb: 2, p: 2, bgcolor: '#F0F7FF', borderRadius: 1, borderLeft: '3px solid', borderColor: 'info.main' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'info.dark', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Gavel sx={{ fontSize: 14 }} /> Actions Upon Approval
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

        {/* Footer: ID + action buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {requestId}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircle />}
              onClick={() => onApprove(requestId)}
              sx={{ minWidth: 140 }}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Cancel />}
              onClick={() => onReject(requestId)}
              sx={{ minWidth: 140 }}
            >
              Reject
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default ApprovalCard
