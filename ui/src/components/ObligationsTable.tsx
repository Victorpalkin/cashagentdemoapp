import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import { Warning } from '@mui/icons-material'
import StatusBadge from './StatusBadge'
import { Obligation } from '../api/bigquery'

interface ObligationsTableProps {
  obligations: Obligation[]
  isLoading: boolean
}

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const ObligationsTable = ({ obligations, isLoading }: ObligationsTableProps) => {
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
          Upcoming Obligations
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          All open AR and AP items sorted by due date
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : obligations.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No open obligations found
          </Typography>
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E0E0E0' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Counterparty</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Amount</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Currency</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {obligations.map((obligation) => {
                  const isAnomaly = obligation.type === 'AR' && obligation.probability !== undefined && obligation.probability < 0.6
                  return (
                    <TableRow
                      key={obligation.id}
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        bgcolor: obligation.status === 'OVERDUE'
                          ? 'error.light'
                          : isAnomaly
                            ? 'warning.light'
                            : 'inherit',
                        opacity: obligation.status === 'OVERDUE' ? 0.9 : 1,
                      }}
                    >
                      <TableCell>{formatDate(obligation.date)}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: obligation.type === 'AR' ? 'success.main' : 'warning.main'
                          }}
                        >
                          {obligation.type}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {obligation.counterparty}
                          {isAnomaly && (
                            <Tooltip title={`Low probability: ${Math.round((obligation.probability ?? 0) * 100)}%`}>
                              <Warning sx={{ fontSize: 16, color: 'warning.main' }} />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatCurrency(obligation.amount, obligation.currency)}
                      </TableCell>
                      <TableCell>{obligation.currency}</TableCell>
                      <TableCell>
                        <StatusBadge status={obligation.status} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  )
}

export default ObligationsTable
