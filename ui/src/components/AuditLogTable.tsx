import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  IconButton,
  Box,
  Typography,
} from '@mui/material'
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material'

interface AuditLog {
  id: string
  timestamp: string
  agent: string
  action: string
  tool: string
  details: string
  fullDetails?: Record<string, unknown>
}

interface AuditLogTableProps {
  logs: AuditLog[]
}

const Row = ({ log }: { log: AuditLog }) => {
  const [open, setOpen] = useState(false)

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <>
      <TableRow sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {log.agent}
          </Typography>
        </TableCell>
        <TableCell>{log.action}</TableCell>
        <TableCell>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              bgcolor: 'grey.100',
              px: 1,
              py: 0.5,
              borderRadius: 0.5,
              display: 'inline-block',
            }}
          >
            {log.tool}
          </Typography>
        </TableCell>
        <TableCell sx={{ maxWidth: 400 }}>
          <Typography variant="body2" noWrap>
            {log.details}
          </Typography>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Full Details:
              </Typography>
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(log.fullDetails || { details: log.details }, null, 2)}
              </Typography>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

const AuditLogTable = ({ logs }: AuditLogTableProps) => {
  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E0E0E0' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 50 }} />
            <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Agent</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Tool</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.map((log) => (
            <Row key={log.id} log={log} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default AuditLogTable
