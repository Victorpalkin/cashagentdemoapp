import {
  Box, Typography, Card, CardContent, Chip, Button, CircularProgress, Alert,
  Collapse,
} from '@mui/material'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ExpandMore, ExpandLess } from '@mui/icons-material'
import StatusBadge from '../components/StatusBadge'
import { getRecommendations, dismissRecommendation, Recommendation } from '../api/bigquery'

const PRIORITY_ORDER = ['HIGH', 'MEDIUM', 'LOW'] as const

const priorityColor = (priority: string): 'error' | 'warning' | 'info' => {
  switch (priority) {
    case 'HIGH': return 'error'
    case 'MEDIUM': return 'warning'
    case 'LOW': return 'info'
    default: return 'info'
  }
}

const statusMapping = (status: string) => {
  switch (status) {
    case 'PENDING_APPROVAL': return 'PENDING'
    case 'RECOMMENDED': return 'MEDIUM'
    case 'AUTO_EXECUTED': return 'APPROVED'
    case 'DISMISSED': return 'REJECTED'
    default: return 'PENDING'
  }
}

const Recommendations = () => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  const { data: recommendations = [], isLoading, isError } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => getRecommendations(),
    refetchInterval: 10000,
  })

  const dismissMutation = useMutation({
    mutationFn: (id: string) => dismissRecommendation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  })

  const formatCurrency = (amount: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const grouped = PRIORITY_ORDER.map(priority => ({
    priority,
    items: recommendations.filter((r: Recommendation) => r.priority === priority),
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
        <Alert severity="error">Failed to load recommendations</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Agent Recommendations
      </Typography>

      {recommendations.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No recommendations yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The autonomous agent will generate recommendations during its scheduled runs.
          </Typography>
        </Box>
      ) : (
        grouped.map(({ priority, items }) => (
          <Box key={priority} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Chip
                label={priority}
                color={priorityColor(priority)}
                size="small"
                sx={{ fontWeight: 700 }}
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Priority ({items.length})
              </Typography>
            </Box>

            {items.map((rec: Recommendation) => (
              <Card
                key={rec.recommendation_id}
                elevation={0}
                sx={{
                  mb: 2,
                  border: '1px solid #E0E0E0',
                  '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
                }}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={rec.priority}
                        color={priorityColor(rec.priority)}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                      <Chip
                        label={rec.action_type}
                        variant="outlined"
                        size="small"
                        sx={{ fontWeight: 500 }}
                      />
                      <Typography variant="h6" sx={{ fontWeight: 700, ml: 1 }}>
                        {formatCurrency(rec.amount, rec.currency)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StatusBadge status={statusMapping(rec.status) as any} />
                      <Typography variant="caption" color="text.secondary">
                        {rec.status.replace(/_/g, ' ')}
                      </Typography>
                    </Box>
                  </Box>

                  <Typography variant="body1" sx={{ mb: 1 }}>
                    {rec.description}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    {formatTimestamp(rec.created_at)}
                  </Typography>

                  <Box sx={{ mt: 1.5 }}>
                    <Button
                      size="small"
                      onClick={() => toggleExpanded(rec.recommendation_id)}
                      endIcon={expandedIds.has(rec.recommendation_id) ? <ExpandLess /> : <ExpandMore />}
                      sx={{ textTransform: 'none', px: 0 }}
                    >
                      Rationale
                    </Button>
                    <Collapse in={expandedIds.has(rec.recommendation_id)}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}
                      >
                        {rec.rationale}
                      </Typography>
                    </Collapse>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                    {rec.approval_request_id && (
                      <Chip
                        label={`View Approval: ${rec.approval_request_id}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        clickable
                        component="a"
                        href={`/approvals`}
                        sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                      />
                    )}
                    {rec.status !== 'DISMISSED' && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        onClick={() => dismissMutation.mutate(rec.recommendation_id)}
                        disabled={dismissMutation.isPending}
                        sx={{ ml: 'auto', textTransform: 'none' }}
                      >
                        Dismiss
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        ))
      )}
    </Box>
  )
}

export default Recommendations
