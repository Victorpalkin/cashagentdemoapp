import { Card, CardContent, Typography, Box, Button } from '@mui/material'
import { CheckCircle, Cancel } from '@mui/icons-material'

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
  return (
    <Card sx={{ mb: 2, border: '2px solid', borderColor: 'warning.main' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {actionType}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {formatCurrency(amount, currency)}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {formatTimestamp(timestamp)}
          </Typography>
        </Box>

        <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
          {description}
        </Typography>

        <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1, mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 600 }}>
            Agent Reasoning:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {reasoning.length > 200 ? `${reasoning.substring(0, 200)}...` : reasoning}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircle />}
            onClick={() => onApprove(requestId)}
            sx={{ flex: 1 }}
          >
            Approve
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<Cancel />}
            onClick={() => onReject(requestId)}
            sx={{ flex: 1 }}
          >
            Reject
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

export default ApprovalCard
