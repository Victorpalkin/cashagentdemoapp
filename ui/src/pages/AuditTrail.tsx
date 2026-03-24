import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material'
import { Download } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import AuditLogTable from '../components/AuditLogTable'
import { getAuditLog } from '../api/bigquery'

const AuditTrail = () => {
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  })
  const [selectedAgent, setSelectedAgent] = useState('all')
  const [selectedAction, setSelectedAction] = useState('all')

  const { data: auditLogs = [], isLoading, isError } = useQuery({
    queryKey: ['auditLog', 'full'],
    queryFn: () => getAuditLog(200),
    refetchInterval: 10000,
  })

  const agents = ['all', ...new Set(auditLogs.map(l => l.agent_name).filter(Boolean))]
  const actionTypes = ['all', ...new Set(auditLogs.map(l => l.action).filter(Boolean))]

  // Map AuditLog to the format AuditLogTable expects
  const mappedLogs = auditLogs.map((log, idx) => ({
    id: String(idx + 1),
    timestamp: log.timestamp,
    agent: log.agent_name,
    action: log.action,
    tool: log.tool_name,
    details: log.output_summary || log.input_summary,
  }))

  const filteredLogs = mappedLogs.filter(log => {
    const matchesAgent = selectedAgent === 'all' || log.agent === selectedAgent
    const matchesAction = selectedAction === 'all' || log.action === selectedAction
    const logDate = new Date(log.timestamp)
    const matchesDateRange = logDate >= new Date(dateFrom) && logDate <= new Date(dateTo + 'T23:59:59')
    return matchesAgent && matchesAction && matchesDateRange
  })

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Agent', 'Action', 'Tool', 'Details'],
      ...filteredLogs.map(log => [
        log.timestamp,
        log.agent,
        log.action,
        log.tool,
        log.details.replace(/,/g, ';'),
      ]),
    ]
      .map(row => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Audit Trail
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Complete log of all agent queries, analyses, recommendations, and executions
      </Typography>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load audit log</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={2}>
              <TextField
                label="From Date"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                label="To Date"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Agent"
                select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                fullWidth
                size="small"
              >
                {agents.map(agent => (
                  <MenuItem key={agent} value={agent}>
                    {agent === 'all' ? 'All Agents' : agent}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Action Type"
                select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                fullWidth
                size="small"
              >
                {actionTypes.map(action => (
                  <MenuItem key={action} value={action}>
                    {action === 'all' ? 'All Actions' : action}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={handleExport}
                fullWidth
              >
                Export CSV
              </Button>
            </Grid>
          </Grid>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {isLoading ? 'Loading...' : `Showing ${filteredLogs.length} of ${mappedLogs.length} records`}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <AuditLogTable logs={filteredLogs} />
      )}
    </Box>
  )
}

export default AuditTrail
