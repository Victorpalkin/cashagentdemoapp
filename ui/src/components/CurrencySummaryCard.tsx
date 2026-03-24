import { Card, CardContent, Typography, Box } from '@mui/material'

interface CurrencyBreakdown {
  currency: string
  amount: number
  percentage: number
  color: string
}

interface CurrencySummaryCardProps {
  totalUsd: number
  breakdown: CurrencyBreakdown[]
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const CurrencySummaryCard = ({ totalUsd, breakdown }: CurrencySummaryCardProps) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
          Total Cash Position
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Aggregate bank account balances converted to USD
        </Typography>

        <Typography variant="h3" sx={{ fontWeight: 700, mb: 3, color: 'primary.main' }}>
          {formatCurrency(totalUsd)}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              height: 8,
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: 'grey.200',
            }}
          >
            {breakdown.map((item) => (
              <Box
                key={item.currency}
                sx={{
                  width: `${item.percentage}%`,
                  bgcolor: item.color,
                  transition: 'width 0.3s ease',
                }}
              />
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {breakdown.map((item) => (
            <Box key={item.currency} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: item.color,
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  {item.currency}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatCurrency(item.amount)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 50, textAlign: 'right' }}>
                  {item.percentage.toFixed(1)}%
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}

export default CurrencySummaryCard
