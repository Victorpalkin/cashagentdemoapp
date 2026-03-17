import { Card, CardContent, Typography, Box } from '@mui/material'
import { TrendingUp, TrendingDown } from '@mui/icons-material'

interface CashPositionCardProps {
  currency: string
  balance: number
  usdEquivalent: number
  changePercent: number
}

const getCurrencyFlag = (currency: string): string => {
  const flags: Record<string, string> = {
    USD: '🇺🇸',
    EUR: '🇪🇺',
    GBP: '🇬🇧',
  }
  return flags[currency] || '💰'
}

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const CashPositionCard = ({ currency, balance, usdEquivalent, changePercent }: CashPositionCardProps) => {
  const isPositive = changePercent >= 0

  return (
    <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' } }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h3" component="span">
            {getCurrencyFlag(currency)}
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
            {currency}
          </Typography>
        </Box>

        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
          {formatCurrency(balance, currency)}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {formatCurrency(usdEquivalent, 'USD')} USD
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isPositive ? (
            <TrendingUp sx={{ color: 'success.main', fontSize: 20 }} />
          ) : (
            <TrendingDown sx={{ color: 'error.main', fontSize: 20 }} />
          )}
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: isPositive ? 'success.main' : 'error.main',
            }}
          >
            {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            vs. last week
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

export default CashPositionCard
