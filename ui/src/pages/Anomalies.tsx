import {
  Box, Typography, Card, CardContent, Chip, CircularProgress, Alert,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { getAnomalies, Anomaly } from '../api/bigquery'

const SEVERITY_ORDER = ['HIGH', 'MEDIUM'] as const

const severityColor = (severity: string): 'error' | 'warning' => {
  return severity === 'HIGH' ? 'error' : 'warning'
}

const TYPE_LABELS: Record<string, string> = {
  TIMESFM_CASH_FLOW_ANOMALY: 'TimesFM Cash Flow Anomaly',
  LOW_PROBABILITY_RECEIVABLE: 'Low Probability Receivable',
  AP_CONCENTRATION: 'AP Concentration',
}

const formatDetailValue = (value: any): string => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return String(value)
}

const Anomalies = () => {
  const { data: anomalies = [], isLoading, isError } = useQuery({
    queryKey: ['anomalies'],
    queryFn: () => getAnomalies(),
    refetchInterval: 30000,
  })

  const grouped = SEVERITY_ORDER.map(severity => ({
    severity,
    items: anomalies.filter((a: Anomaly) => a.severity === severity),
  })).filter(g => g.items.length > 0)

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
        <Alert severity="error">Failed to load anomalies</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Anomaly Detection
      </Typography>

      {anomalies.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No anomalies detected
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The agent scans for cash flow anomalies, risky receivables, and unusual AP concentrations.
          </Typography>
        </Box>
      ) : (
        grouped.map(({ severity, items }) => (
          <Box key={severity} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Chip
                label={severity}
                color={severityColor(severity)}
                size="small"
                sx={{ fontWeight: 700 }}
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Severity ({items.length})
              </Typography>
            </Box>

            {items.map((anomaly: Anomaly, idx: number) => (
              <Card
                key={`${anomaly.type}-${idx}`}
                elevation={0}
                sx={{
                  mb: 2,
                  border: '1px solid #E0E0E0',
                  '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
                }}
              >
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                      label={anomaly.severity}
                      color={severityColor(anomaly.severity)}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                    <Chip
                      label={TYPE_LABELS[anomaly.type] || anomaly.type}
                      variant="outlined"
                      size="small"
                      sx={{ fontWeight: 500 }}
                    />
                  </Box>

                  <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                    {anomaly.description}
                  </Typography>

                  {anomaly.details && Object.keys(anomaly.details).length > 0 && (
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, borderLeft: '3px solid', borderColor: severityColor(anomaly.severity) + '.main' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
                        Details
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1 }}>
                        {Object.entries(anomaly.details).map(([key, value]) => (
                          <Box key={key}>
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                              {key.replace(/_/g, ' ')}
                            </Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {formatDetailValue(value)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        ))
      )}
    </Box>
  )
}

export default Anomalies
