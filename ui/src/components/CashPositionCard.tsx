import { useState } from 'react'
import { Card, CardContent, Typography, Box, Collapse, IconButton } from '@mui/material'
import { TrendingUp, TrendingDown, ExpandMore } from '@mui/icons-material'

interface BankAccountSummary {
  bank_name: string
  account_type: string
  current_balance: number
  usd_equivalent: number
}

interface CashPositionCardProps {
  currency: string
  balance: number
  usdEquivalent: number
  changePercent: number
  accounts?: BankAccountSummary[]
}

const getCurrencyFlag = (currency: string): string => {
  const flags: Record<string, string> = {
    USD: '\u{1F1FA}\u{1F1F8}',
    EUR: '\u{1F1EA}\u{1F1FA}',
    GBP: '\u{1F1EC}\u{1F1E7}',
    JPY: '\u{1F1EF}\u{1F1F5}',
    CHF: '\u{1F1E8}\u{1F1ED}',
    SGD: '\u{1F1F8}\u{1F1EC}',
    AUD: '\u{1F1E6}\u{1F1FA}',
  }
  return flags[currency] || '\u{1F4B0}'
}

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatAccountType = (type: string): string => {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const CashPositionCard = ({ currency, balance, usdEquivalent, changePercent, accounts = [] }: CashPositionCardProps) => {
  const isPositive = changePercent >= 0
  const [expanded, setExpanded] = useState(false)

  return (
    <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' } }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.08em' }}>
            Cash Position
          </Typography>
          {accounts.length > 0 && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ mt: -0.5, mr: -1 }}
            >
              <ExpandMore
                sx={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  fontSize: 20,
                }}
              />
            </IconButton>
          )}
        </Box>
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

        <Collapse in={expanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              By Account
            </Typography>
            {accounts.map((acct, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 0.75,
                  borderBottom: idx < accounts.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {acct.bank_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatAccountType(acct.account_type)}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatCurrency(acct.current_balance, currency)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  )
}

export default CashPositionCard
