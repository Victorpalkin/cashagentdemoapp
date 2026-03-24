import {
  Box, Typography, Card, CardContent, Chip, CircularProgress, Alert,
} from '@mui/material'
import { Lightbulb, OpenInNew } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { getAnomalies, getAnomalyExplanations, getRecommendations, Anomaly, Recommendation } from '../api/bigquery'

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

  const { data: explanations, isLoading: explanationsLoading } = useQuery({
    queryKey: ['anomaly-explanations'],
    queryFn: () => getAnomalyExplanations(),
    enabled: anomalies.length > 0,
    refetchInterval: 300000, // 5 min, matches backend cache TTL
  })

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => getRecommendations(),
    refetchInterval: 30000,
  })

  // Build map from anomaly type to linked recommendations
  const linkedRecs = new Map<string, Recommendation[]>()
  for (const rec of recommendations) {
    if (rec.source_anomaly_type) {
      const existing = linkedRecs.get(rec.source_anomaly_type) || []
      existing.push(rec)
      linkedRecs.set(rec.source_anomaly_type, existing)
    }
  }

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
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Anomaly Detection
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        TimesFM anomaly detection on cash flows combined with rule-based checks on AR/AP data
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

            {items.map((anomaly: Anomaly, idx: number) => {
              const recs = linkedRecs.get(anomaly.type) || []
              // Find the global index of this anomaly to match with explanations array
              const globalIdx = anomalies.indexOf(anomaly)
              const explanation = explanations?.[globalIdx]

              return (
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

                    {/* Gemini Explanation */}
                    {explanation ? (
                      <Box sx={{ mb: 2, p: 2, bgcolor: '#E3F2FD', borderRadius: 1, borderLeft: '3px solid', borderColor: 'info.main' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: 'info.dark', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Lightbulb sx={{ fontSize: 14 }} /> AI Analysis
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.7 }}>
                          {explanation.explanation}
                        </Typography>
                        {explanation.suggested_action && (
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'info.dark' }}>
                            Suggested action: {explanation.suggested_action}
                          </Typography>
                        )}
                      </Box>
                    ) : explanationsLoading ? (
                      <Box sx={{ mb: 2, p: 2, bgcolor: '#E3F2FD', borderRadius: 1, borderLeft: '3px solid', borderColor: 'info.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="body2" color="text.secondary">Loading AI analysis...</Typography>
                      </Box>
                    ) : null}

                    {/* Linked Recommendations */}
                    {recs.length > 0 && (
                      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {recs.map((rec) => (
                          <Chip
                            key={rec.recommendation_id}
                            icon={<OpenInNew sx={{ fontSize: 14 }} />}
                            label={`View Recommendation: ${rec.recommendation_id}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            clickable
                            component="a"
                            href="/recommendations"
                            sx={{ fontWeight: 600 }}
                          />
                        ))}
                      </Box>
                    )}

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
              )
            })}
          </Box>
        ))
      )}
    </Box>
  )
}

export default Anomalies
