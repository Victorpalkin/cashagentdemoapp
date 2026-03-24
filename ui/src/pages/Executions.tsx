import { useState } from 'react'
import {
  Box, Typography, Card, CardContent, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, CircularProgress, Alert,
  Collapse, IconButton,
} from '@mui/material'
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material'
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

const DETAIL_LABELS: Record<string, string> = {
  bank_name: 'Bank',
  currency: 'Currency',
  amount: 'Amount',
  term_days: 'Term',
  rate_pct: 'Rate',
  maturity_date: 'Maturity Date',
  expected_interest: 'Expected Interest',
  value_date: 'Value Date',
  confirmation_id: 'Confirmation ID',
  deposit_id: 'Deposit ID',
  buy_currency: 'Buy Currency',
  sell_currency: 'Sell Currency',
  buy_amount: 'Buy Amount',
  sell_amount: 'Sell Amount',
  rate: 'Rate',
  trade_type: 'Trade Type',
  settlement_date: 'Settlement Date',
  counterparty: 'Counterparty',
  contract_id: 'Contract ID',
  trade_id: 'Trade ID',
  status: 'Status',
}

const formatDetailValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined) return '-'
  if (key === 'term_days') return `${value} days`
  if (key === 'rate_pct') return `${value}%`
  if (key === 'expected_interest' || key === 'amount' || key === 'buy_amount' || key === 'sell_amount') {
    return typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)
  }
  if (key === 'rate' && typeof value === 'number') return value.toFixed(4)
  return String(value)
}

const Executions = () => {
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
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
                <TableCell sx={{ width: 40, p: 0.5 }} />
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
              {executions.map((exec: Execution, idx: number) => {
                const isExpanded = expandedRow === idx
                const allDetails: Record<string, unknown> = { ...exec.details }
                // Remove status from detail panel (already shown in row)
                delete allDetails.status
                const detailEntries = Object.entries(allDetails).filter(
                  ([, v]) => v !== null && v !== undefined && v !== ''
                )
                return (
                  <>
                    <TableRow
                      key={idx}
                      sx={{ '&:hover': { bgcolor: 'action.hover' }, cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'none' : undefined } }}
                      onClick={() => setExpandedRow(isExpanded ? null : idx)}
                    >
                      <TableCell sx={{ p: 0.5 }}>
                        <IconButton size="small">
                          {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                        </IconButton>
                      </TableCell>
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
                    <TableRow key={`${idx}-details`}>
                      <TableCell sx={{ p: 0, border: 'none' }} colSpan={9}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2.5, bgcolor: 'grey.50', borderBottom: '1px solid #E0E0E0' }}>
                            {exec.input_summary && (
                              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, borderLeft: '3px solid', borderColor: 'primary.main' }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                                  Trigger
                                </Typography>
                                <Typography variant="body2">{exec.input_summary}</Typography>
                              </Box>
                            )}
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                              {detailEntries.map(([key, value]) => (
                                <Box key={key} sx={{ display: 'flex', gap: 1 }}>
                                  <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 130, fontWeight: 600 }}>
                                    {DETAIL_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {formatDetailValue(key, value)}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

export default Executions
