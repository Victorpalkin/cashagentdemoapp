import { Card, CardContent, Typography, Box, Chip, CircularProgress } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getAnomalies } from '../api/bigquery'

const AnomalySummaryCard = () => {
  const navigate = useNavigate()
  const { data: anomalies, isLoading } = useQuery({ queryKey: ['anomalies'], queryFn: getAnomalies })

  const highCount = anomalies?.filter(a => a.severity === 'HIGH').length ?? 0
  const mediumCount = anomalies?.filter(a => a.severity === 'MEDIUM').length ?? 0
  const total = (anomalies?.length) ?? 0

  return (
    <Card
      sx={{ height: '100%', cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}
      onClick={() => navigate('/anomalies')}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
          Anomaly Summary
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Detected anomalies feeding agent recommendations
        </Typography>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
        ) : total === 0 ? (
          <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
            No anomalies detected
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="h3" sx={{ fontWeight: 700, color: highCount > 0 ? 'error.main' : 'warning.main' }}>
              {total}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {highCount > 0 && (
                <Chip label={`${highCount} HIGH`} size="small" color="error" sx={{ fontWeight: 600 }} />
              )}
              {mediumCount > 0 && (
                <Chip label={`${mediumCount} MEDIUM`} size="small" color="warning" sx={{ fontWeight: 600 }} />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Click to view details
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

export default AnomalySummaryCard
