import { Card, CardContent, Typography, Box, CircularProgress, Chip } from '@mui/material'
import { CurrencyExchange } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { getFxRates } from '../api/bigquery'

const PAIR_LABELS: Record<string, string> = {
  'EUR-USD': 'EUR/USD',
  'GBP-USD': 'GBP/USD',
  'EUR-GBP': 'EUR/GBP',
}

const FxRatesCard = () => {
  const { data: rates = [], isLoading } = useQuery({
    queryKey: ['fxRates'],
    queryFn: getFxRates,
    refetchInterval: 60000,
  })

  const displayPairs = rates
    .filter(r => {
      const key = `${r.from_currency}-${r.to_currency}`
      return key in PAIR_LABELS
    })
    .map(r => ({
      pair: PAIR_LABELS[`${r.from_currency}-${r.to_currency}`],
      rate: r.exchange_rate,
      date: r.rate_date,
    }))

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CurrencyExchange color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            FX Rates
          </Typography>
          <Chip label="Live" color="success" size="small" sx={{ ml: 'auto' }} />
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : displayPairs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No FX rates available for today
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {displayPairs.map(({ pair, rate }) => (
              <Box
                key={pair}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 1.5,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {pair}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                  {rate.toFixed(4)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

export default FxRatesCard
