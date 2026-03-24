import { useState } from 'react'
import {
  Box, Typography, Tabs, Tab, Card, CardContent, Chip, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Divider, MenuItem,
} from '@mui/material'
import {
  AccountBalance, CurrencyExchange, Speed, PlayArrow, CheckCircle, Gavel,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ApprovalCard from '../components/ApprovalCard'
import StatusBadge from '../components/StatusBadge'
import { getApprovals, approveRequest, rejectRequest, createMemory, ApprovalRequest, ApprovalOverrides } from '../api/bigquery'

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PLACE_DEPOSIT: {
    label: 'Place Term Deposit',
    icon: <AccountBalance fontSize="small" />,
    color: '#0070F2',
  },
  HEDGE_FX: {
    label: 'FX Forward Hedge',
    icon: <CurrencyExchange fontSize="small" />,
    color: '#36A41D',
  },
  ACCELERATE_COLLECTION: {
    label: 'Accelerate Collection',
    icon: <Speed fontSize="small" />,
    color: '#E76500',
  },
}

const getExecutionPlan = (actionType: string, amount: number, currency: string): string[] => {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
  switch (actionType) {
    case 'PLACE_DEPOSIT':
      return [
        `Transfer ${formatted} from operating account to term deposit`,
        `Deposit placed with Deutsche Bank at ~4.2% annual rate`,
        `Term: 30 days, maturity auto-credited back to operating account`,
        `Confirmation ID and maturity date recorded in execution log`,
      ]
    case 'HEDGE_FX':
      return [
        `Execute FX forward contract: sell ${formatted} for USD`,
        `Trade placed with broker at prevailing forward rate`,
        `Settlement in 21 business days`,
        `Locks in exchange rate, eliminating FX risk on this exposure`,
        `Trade confirmation and rate recorded in execution log`,
      ]
    case 'ACCELERATE_COLLECTION':
      return [
        `Flag receivable for immediate follow-up by collections team`,
        `Send automated payment reminder to customer`,
        `Escalate to VP Treasury for direct counterparty engagement`,
        `Monitor payment status daily until resolved`,
      ]
    default:
      return [`Execute ${actionType.replace(/_/g, ' ').toLowerCase()} for ${formatted}`]
  }
}

const Approvals = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [mutatingId, setMutatingId] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [rememberDialog, setRememberDialog] = useState<{
    open: boolean; source: string; content: string;
    relatedActionType: string; relatedEntity: string; category: string;
  }>({ open: false, source: '', content: '', relatedActionType: '', relatedEntity: '', category: 'COUNTERPARTY' })
  const queryClient = useQueryClient()

  const { data: approvals = [], isLoading, isError } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => getApprovals(),
    refetchInterval: 5000,
  })

  const approveMutation = useMutation({
    mutationFn: ({ requestId, overrides }: { requestId: string; overrides?: ApprovalOverrides }) =>
      approveRequest(requestId, overrides),
    onSuccess: (_data, variables) => {
      const { overrides } = variables
      setMutatingId(null)
      setMutationError(null)
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      if (overrides && Object.keys(overrides).length > 0) {
        const parts: string[] = []
        if (overrides.amount !== undefined) parts.push(`amount to ${overrides.amount.toLocaleString()}`)
        if (overrides.action_type) parts.push(`action to ${overrides.action_type.replace(/_/g, ' ')}`)
        if (overrides.currency) parts.push(`currency to ${overrides.currency}`)
        const content = `Edited approval before approving: changed ${parts.join(', ')}.`
        const approval = approvals.find(a => a.request_id === variables.requestId)
        setRememberDialog({
          open: true,
          source: 'EDIT',
          content,
          relatedActionType: approval?.action_type || '',
          relatedEntity: approval?.currency || '',
          category: 'PREFERENCE',
        })
      }
    },
    onError: (err: Error) => {
      setMutationError(err.message)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      rejectRequest(requestId, reason),
    onSuccess: (_data, variables) => {
      setMutatingId(null)
      setMutationError(null)
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      setRejectDialogOpen(false)
      const approval = approvals.find(a => a.request_id === variables.requestId)
      setRememberDialog({
        open: true,
        source: 'REJECTION',
        content: variables.reason || 'Rejected without specific reason.',
        relatedActionType: approval?.action_type || '',
        relatedEntity: approval?.description?.split(' ')[0] || '',
        category: 'COUNTERPARTY',
      })
      setRejectReason('')
    },
    onError: (err: Error) => {
      setMutationError(err.message)
    },
  })

  const handleApprove = (requestId: string, overrides?: ApprovalOverrides) => {
    setMutatingId(requestId)
    setMutationError(null)
    approveMutation.mutate({ requestId, overrides })
  }

  const handleRejectClick = (requestId: string) => {
    setRejectingId(requestId)
    setMutatingId(requestId)
    setMutationError(null)
    setRejectDialogOpen(true)
  }

  const handleRejectConfirm = () => {
    rejectMutation.mutate({ requestId: rejectingId, reason: rejectReason })
  }

  const pendingApprovals = approvals.filter(a => a.status === 'PENDING')
  const historyApprovals = approvals.filter(a => a.status !== 'PENDING')

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

  const renderHistoryCard = (approval: ApprovalRequest) => {
    const actionCfg = ACTION_CONFIG[approval.action_type] || {
      label: approval.action_type.replace(/_/g, ' '),
      icon: <PlayArrow fontSize="small" />,
      color: '#666',
    }
    const executionSteps = getExecutionPlan(approval.action_type, approval.amount, approval.currency)
    const isApproved = approval.status === 'APPROVED'

    return (
      <Card
        key={approval.request_id}
        elevation={0}
        sx={{
          mb: 2,
          border: '1px solid #E0E0E0',
          opacity: approval.status === 'REJECTED' ? 0.75 : 1,
        }}
      >
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Chip
                icon={actionCfg.icon as React.ReactElement}
                label={actionCfg.label}
                sx={{
                  fontWeight: 600,
                  bgcolor: `${actionCfg.color}14`,
                  color: actionCfg.color,
                  border: `1px solid ${actionCfg.color}40`,
                  '& .MuiChip-icon': { color: actionCfg.color },
                }}
              />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {formatCurrency(approval.amount, approval.currency)}
              </Typography>
            </Box>
            <StatusBadge status={approval.status} />
          </Box>

          {/* Description */}
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
            {approval.description}
          </Typography>

          {/* Reasoning */}
          <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, borderLeft: '3px solid', borderColor: 'primary.main' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
              Agent Reasoning
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {approval.agent_reasoning}
            </Typography>
          </Box>

          {/* Execution Plan */}
          <Box sx={{ mb: 2, p: 2, bgcolor: isApproved ? '#F0FFF0' : '#FFF5F5', borderRadius: 1, borderLeft: '3px solid', borderColor: isApproved ? 'success.main' : 'error.main' }}>
            <Typography variant="subtitle2" sx={{
              fontWeight: 700, mb: 1, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1,
              color: isApproved ? 'success.dark' : 'error.dark',
              display: 'flex', alignItems: 'center', gap: 0.5,
            }}>
              {isApproved ? (
                <><CheckCircle sx={{ fontSize: 14 }} /> Actions Executed</>
              ) : (
                <><Gavel sx={{ fontSize: 14 }} /> Actions Proposed (Rejected)</>
              )}
            </Typography>
            <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
              {executionSteps.map((step, i) => (
                <Typography
                  component="li" variant="body2" key={i}
                  sx={{
                    mb: 0.5, lineHeight: 1.6,
                    textDecoration: !isApproved ? 'line-through' : 'none',
                    color: !isApproved ? 'text.secondary' : 'text.primary',
                  }}
                >
                  {step}
                </Typography>
              ))}
            </Box>
          </Box>

          {/* Decision details */}
          {(approval.approved_by || approval.rejection_reason) && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              {approval.approved_by && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{isApproved ? 'Approved' : 'Rejected'} by:</strong> {approval.approved_by}
                  {approval.approved_at && <> on {formatTimestamp(approval.approved_at)}</>}
                </Typography>
              )}
              {approval.rejection_reason && (
                <Typography variant="body2">
                  <strong>Reason:</strong> {approval.rejection_reason}
                </Typography>
              )}
            </Box>
          )}

          <Divider sx={{ my: 1.5 }} />

          {/* Footer */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {approval.request_id}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Requested {formatTimestamp(approval.requested_at)}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

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
        <Alert severity="error">Failed to load approvals</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Agent Approvals
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label={`Pending (${pendingApprovals.length})`} />
          <Tab label={`History (${historyApprovals.length})`} />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Box>
          {pendingApprovals.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">
                No pending approvals
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Approvals will appear here when the agent creates requests exceeding $500K
              </Typography>
            </Box>
          ) : (
            pendingApprovals.map(approval => (
              <ApprovalCard
                key={approval.request_id}
                requestId={approval.request_id}
                actionType={approval.action_type}
                amount={approval.amount}
                currency={approval.currency}
                description={approval.description}
                reasoning={approval.agent_reasoning || ''}
                timestamp={approval.requested_at}
                onApprove={handleApprove}
                onReject={handleRejectClick}
                isLoading={mutatingId === approval.request_id && (approveMutation.isPending || rejectMutation.isPending)}
                error={mutatingId === approval.request_id ? mutationError : null}
              />
            ))
          )}
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          {historyApprovals.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">
                No approval history yet
              </Typography>
            </Box>
          ) : (
            historyApprovals.map(renderHistoryCard)
          )}
        </Box>
      )}

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Approval Request</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason for rejection"
            fullWidth
            multiline
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRejectConfirm}
            color="error"
            variant="contained"
            disabled={rejectMutation.isPending}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remember This? Dialog */}
      <Dialog
        open={rememberDialog.open}
        onClose={() => setRememberDialog(d => ({ ...d, open: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Should the agent remember this?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will be stored as agent memory and consulted when generating future recommendations.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="What should the agent remember?"
            fullWidth
            multiline
            rows={3}
            value={rememberDialog.content}
            onChange={(e) => setRememberDialog(d => ({ ...d, content: e.target.value }))}
          />
          <TextField
            select
            margin="dense"
            label="Category"
            fullWidth
            value={rememberDialog.category}
            onChange={(e) => setRememberDialog(d => ({ ...d, category: e.target.value }))}
          >
            <MenuItem value="COUNTERPARTY">Counterparty</MenuItem>
            <MenuItem value="INSTRUMENT">Instrument</MenuItem>
            <MenuItem value="POLICY_OVERRIDE">Policy Override</MenuItem>
            <MenuItem value="PREFERENCE">Preference</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRememberDialog(d => ({ ...d, open: false }))}>
            No, Skip
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              createMemory({
                content: rememberDialog.content,
                category: rememberDialog.category,
                source: rememberDialog.source,
                related_action_type: rememberDialog.relatedActionType || undefined,
                related_entity: rememberDialog.relatedEntity || undefined,
              }).then(() => {
                queryClient.invalidateQueries({ queryKey: ['memories'] })
              })
              setRememberDialog(d => ({ ...d, open: false }))
            }}
            disabled={!rememberDialog.content.trim()}
          >
            Yes, Remember
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Approvals
