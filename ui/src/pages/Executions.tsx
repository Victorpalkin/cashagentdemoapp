import {
  Box, Typography, Card, CardContent, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, CircularProgress, Alert,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { getExecutions, Execution } from '../api/bigquery'

const TYPE_COLORS: Record<string, 'primary' | 'success' | 'warning' | 'secondary'> = {
  place_deposit: 'primary',
  hedge_fx: 'success',
  execute_transfer: 'warning',
  place_investment: 'secondary',
  accelerate_collection: 'warning',
}

const TYPE_LABELS: Record<string, string> = {
  place_deposit: 'Deposit',
  hedge_fx: 'FX Trade',
  execute_transfer: 'Transfer',
  place_investment: 'Investment',
  accelerate_collection: 'Collection',
}

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const formatAmount = (amount: number | undefined, currency: string | undefined): string => {
  if (!amount || !currency) return '-'
  const symbol: Record<string, string> = { USD: '$', EUR: '\u20AC', GBP: '\u00A3' }
  return `${symbol[currency] || ''}${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

const Executions = () => {
  const { data: executions = [], isLoading, isError } = useQuery({
    queryKey: ['executions'],
    queryFn: () => getExecutions(),
    refetchInterval: 10000,
  })

  // Summary stats
  const depositCount = executions.filter(e => e.tool_name === 'place_deposit').length
  const fxCount = executions.filter(e => e.tool_name === 'hedge_fx').length
  const otherCount = executions.length - depositCount - fxCount

  const depositTotal = executions
    .filter(e => e.tool_name === 'place_deposit')
    .reduce((sum, e) => sum + (e.details?.amount || 0), 0)
  const fxTotal = executions
    .filter(e => e.tool_name === 'hedge_fx')
    .reduce((sum, e) => sum + (e.details?.buy_amount || e.details?.amount || 0), 0)

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
        <Alert severity="error">Failed to load executions</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Execution History
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Completed agent actions including deposits placed, FX hedges, and collections
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="body2" color="text.secondary">Deposits</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{depositCount}</Typography>
              {depositTotal > 0 && (
                <Typography variant="body2" color="text.secondary">
                  ${depositTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} total
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="body2" color="text.secondary">FX Trades</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{fxCount}</Typography>
              {fxTotal > 0 && (
                <Typography variant="body2" color="text.secondary">
                  ${fxTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} total
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="body2" color="text.secondary">Other Actions</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{otherCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {executions.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              No executions yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Actions appear here as the agent auto-executes low-value recommendations or approved items are processed.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E0E0E0' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Confirmation ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Counterparty</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Amount</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Rate</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Settlement</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {executions.map((exec: Execution, idx: number) => (
                <TableRow key={idx} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  <TableCell>{formatTimestamp(exec.timestamp)}</TableCell>
                  <TableCell>
                    <Chip
                      label={TYPE_LABELS[exec.tool_name] || exec.tool_name}
                      color={TYPE_COLORS[exec.tool_name] || 'default'}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {exec.details?.confirmation_id || exec.details?.trade_id || exec.details?.deposit_id || '-'}
                  </TableCell>
                  <TableCell>
                    {exec.details?.bank_name || exec.details?.counterparty || exec.agent_name}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatAmount(
                      exec.details?.amount || exec.details?.buy_amount,
                      exec.details?.currency || exec.details?.buy_currency,
                    )}
                  </TableCell>
                  <TableCell>
                    {exec.details?.rate ? exec.details.rate.toFixed(4) :
                     exec.details?.rate_pct ? `${exec.details.rate_pct}%` : '-'}
                  </TableCell>
                  <TableCell>
                    {exec.details?.settlement_date || exec.details?.maturity_date || '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={exec.details?.status === 'error' ? 'Failed' : 'Completed'}
                      color={exec.details?.status === 'error' ? 'error' : 'success'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

export default Executions
