import { useState } from 'react'
import {
  Box, Typography, Card, CardContent, Chip, Button, CircularProgress, Alert,
  Divider, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Select, FormControl, InputLabel,
} from '@mui/material'
import {
  AccountBalance, CurrencyExchange, Speed, TrendingUp,
  Gavel, PlayArrow, CheckCircle, BugReport, Cancel, Edit as EditIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import StatusBadge from '../components/StatusBadge'
import {
  getRecommendations, dismissRecommendation, Recommendation,
  getApprovals, approveRequest, rejectRequest, createMemory, ApprovalRequest, ApprovalOverrides,
} from '../api/bigquery'

const PRIORITY_ORDER = ['HIGH', 'MEDIUM', 'LOW'] as const

const priorityColor = (priority: string): 'error' | 'warning' | 'info' => {
  switch (priority) {
    case 'HIGH': return 'error'
    case 'MEDIUM': return 'warning'
    case 'LOW': return 'info'
    default: return 'info'
  }
}

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
  PLACE_INVESTMENT: {
    label: 'Place Investment',
    icon: <TrendingUp fontSize="small" />,
    color: '#7B61FF',
  },
}

const ACTION_OPTIONS = [
  { value: 'PLACE_DEPOSIT', label: 'Place Term Deposit' },
  { value: 'HEDGE_FX', label: 'FX Forward Hedge' },
  { value: 'ACCELERATE_COLLECTION', label: 'Accelerate Collection' },
  { value: 'PLACE_INVESTMENT', label: 'Place Investment' },
]

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP']

const getExecutionPlan = (rec: { action_type: string; amount: number; currency: string }): string[] => {
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: rec.currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(rec.amount)

  switch (rec.action_type) {
    case 'PLACE_DEPOSIT':
      return [
        `Transfer ${amount} from operating account to term deposit`,
        `Deposit placed with Deutsche Bank at ~4.2% annual rate`,
        `Term: 30 days, maturity auto-credited back to operating account`,
        `Confirmation ID and maturity date recorded in execution log`,
      ]
    case 'HEDGE_FX':
      return [
        `Execute FX forward contract: sell ${amount} for USD`,
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
      return [`Execute ${rec.action_type.replace(/_/g, ' ').toLowerCase()} for ${amount}`]
  }
}

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

const Recommendations = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState(0)

  // Approval state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [mutatingId, setMutatingId] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [rememberDialog, setRememberDialog] = useState<{
    open: boolean; source: string; content: string;
    relatedActionType: string; relatedEntity: string; category: string;
  }>({ open: false, source: '', content: '', relatedActionType: '', relatedEntity: '', category: 'COUNTERPARTY' })

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedActionType, setEditedActionType] = useState('')
  const [editedAmount, setEditedAmount] = useState(0)
  const [editedCurrency, setEditedCurrency] = useState('')

  const { data: recommendations = [], isLoading: recLoading, isError: recError } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => getRecommendations(),
    refetchInterval: 10000,
  })

  const { data: approvals = [], isLoading: appLoading, isError: appError } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => getApprovals(),
    refetchInterval: 5000,
  })

  const dismissMutation = useMutation({
    mutationFn: (id: string) => dismissRecommendation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  })

  const approveMutation = useMutation({
    mutationFn: ({ requestId, overrides }: { requestId: string; overrides?: ApprovalOverrides }) =>
      approveRequest(requestId, overrides),
    onSuccess: (_data, variables) => {
      const { overrides } = variables
      setMutatingId(null)
      setMutationError(null)
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['recommendations'] })
      if (overrides && Object.keys(overrides).length > 0) {
        const editParts: string[] = []
        if (overrides.amount !== undefined) editParts.push(`changed the amount to ${overrides.amount.toLocaleString()}`)
        if (overrides.action_type) editParts.push(`changed the action to ${overrides.action_type.replace(/_/g, ' ')}`)
        if (overrides.currency) editParts.push(`changed the currency to ${overrides.currency}`)
        const approval = approvals.find(a => a.request_id === variables.requestId)
        const description = approval?.description || 'a recommendation'
        const content = `When the agent recommended "${description}", I ${editParts.join(' and ')}. Prefer this adjustment for similar ${approval?.action_type?.replace(/_/g, ' ').toLowerCase() || ''} recommendations.`
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
      queryClient.invalidateQueries({ queryKey: ['recommendations'] })
      setRejectDialogOpen(false)
      const approval = approvals.find(a => a.request_id === variables.requestId)
      const description = approval?.description || 'a recommendation'
      const reasonText = variables.reason
        ? `Rejected recommendation: "${description}". Reason: ${variables.reason}`
        : `Rejected recommendation: "${description}".`
      setRememberDialog({
        open: true,
        source: 'REJECTION',
        content: reasonText,
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

  const handleStartEdit = (approval: ApprovalRequest) => {
    setEditingId(approval.request_id)
    setEditedActionType(approval.action_type)
    setEditedAmount(approval.amount)
    setEditedCurrency(approval.currency)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
  }

  const handleApproveEdited = (requestId: string, originalApproval: ApprovalRequest) => {
    const overrides: ApprovalOverrides = {}
    if (editedActionType !== originalApproval.action_type) overrides.action_type = editedActionType
    if (editedAmount !== originalApproval.amount) overrides.amount = editedAmount
    if (editedCurrency !== originalApproval.currency) overrides.currency = editedCurrency
    handleApprove(requestId, Object.keys(overrides).length > 0 ? overrides : undefined)
  }

  const pendingApprovalMap = new Map(
    approvals.filter(a => a.status === 'PENDING').map(a => [a.request_id, a])
  )
  const historyApprovals = approvals.filter(a => a.status !== 'PENDING')

  const grouped = PRIORITY_ORDER.map(priority => ({
    priority,
    items: recommendations.filter((r: Recommendation) => r.priority === priority),
  })).filter(g => g.items.length > 0)

  const isLoading = recLoading || appLoading
  const isError = recError || appError

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

  const renderRecommendationCard = (rec: Recommendation) => {
    const pendingApproval = rec.approval_request_id ? pendingApprovalMap.get(rec.approval_request_id) : undefined
    const isEditing = pendingApproval && editingId === pendingApproval.request_id
    const isMutating = pendingApproval && mutatingId === pendingApproval.request_id && (approveMutation.isPending || rejectMutation.isPending)
    const cardError = pendingApproval && mutatingId === pendingApproval.request_id ? mutationError : null

    const displayActionType = isEditing ? editedActionType : rec.action_type
    const displayAmount = isEditing ? editedAmount : rec.amount
    const displayCurrency = isEditing ? editedCurrency : rec.currency

    const actionCfg = ACTION_CONFIG[displayActionType] || {
      label: displayActionType.replace(/_/g, ' '),
      icon: <PlayArrow fontSize="small" />,
      color: '#666',
    }
    const executionSteps = getExecutionPlan({ action_type: displayActionType, amount: displayAmount, currency: displayCurrency })

    const hasEdits = isEditing && pendingApproval && (
      editedActionType !== pendingApproval.action_type ||
      editedAmount !== pendingApproval.amount ||
      editedCurrency !== pendingApproval.currency
    )

    return (
      <Card
        key={rec.recommendation_id + rec.created_at}
        elevation={0}
        sx={{
          mb: 2,
          border: pendingApproval ? '2px solid' : '1px solid',
          borderColor: isEditing ? 'info.main' : pendingApproval ? 'warning.main' : '#E0E0E0',
          '&:hover': { borderColor: isEditing ? 'info.main' : pendingApproval ? 'warning.main' : 'primary.main', boxShadow: 1 },
        }}
      >
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          {/* Header: Action type, amount, status */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              {isEditing ? (
                <>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Action Type</InputLabel>
                    <Select
                      value={editedActionType}
                      label="Action Type"
                      onChange={(e) => setEditedActionType(e.target.value)}
                    >
                      {ACTION_OPTIONS.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Amount"
                    type="number"
                    value={editedAmount}
                    onChange={(e) => setEditedAmount(Number(e.target.value))}
                    sx={{ width: 160 }}
                    inputProps={{ min: 0, step: 10000 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <InputLabel>Currency</InputLabel>
                    <Select
                      value={editedCurrency}
                      label="Currency"
                      onChange={(e) => setEditedCurrency(e.target.value)}
                    >
                      {CURRENCY_OPTIONS.map(c => (
                        <MenuItem key={c} value={c}>{c}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              ) : (
                <>
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
                  <Chip
                    label={rec.priority}
                    color={priorityColor(rec.priority)}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {formatCurrency(rec.amount, rec.currency)}
                  </Typography>
                </>
              )}
            </Box>
            {pendingApproval ? (
              <Chip
                label={isEditing ? 'EDITING' : 'PENDING APPROVAL'}
                color={isEditing ? 'info' : 'warning'}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            ) : (
              <StatusBadge status={rec.status as any} />
            )}
          </Box>

          {/* Description */}
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
            {rec.description}
          </Typography>

          {/* Rationale */}
          <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, borderLeft: '3px solid', borderColor: 'primary.main' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
              Agent Rationale
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {rec.rationale}
            </Typography>
          </Box>

          {/* Execution Plan */}
          <Box sx={{ mb: 2, p: 2, bgcolor: '#F0F7FF', borderRadius: 1, borderLeft: '3px solid', borderColor: 'info.main' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'info.dark', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {rec.status === 'AUTO_EXECUTED' ? (
                <><CheckCircle sx={{ fontSize: 14 }} /> Actions Taken</>
              ) : (
                <><Gavel sx={{ fontSize: 14 }} /> Actions Upon Approval {isEditing && hasEdits && '(Updated)'}</>
              )}
            </Typography>
            <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
              {executionSteps.map((step, i) => (
                <Typography component="li" variant="body2" key={i} sx={{ mb: 0.5, lineHeight: 1.6 }}>
                  {step}
                </Typography>
              ))}
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {cardError && (
            <Alert severity="error" sx={{ mb: 2 }}>{cardError}</Alert>
          )}

          {/* Footer: metadata and actions */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                {formatTimestamp(rec.created_at)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                {rec.recommendation_id}
              </Typography>
              {rec.source_anomaly_type && (
                <Chip
                  icon={<BugReport sx={{ fontSize: 14 }} />}
                  label={`Triggered by: ${rec.source_anomaly_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/ /g, ' ')}`}
                  size="small"
                  color="warning"
                  variant="outlined"
                  clickable
                  component="a"
                  href="/anomalies"
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Box>

            {/* Action buttons */}
            {pendingApproval ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                {isEditing ? (
                  <>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleCancelEdit}
                      disabled={!!isMutating}
                      sx={{ textTransform: 'none' }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={isMutating ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                      onClick={() => handleApproveEdited(pendingApproval.request_id, pendingApproval)}
                      disabled={!!isMutating}
                      sx={{ textTransform: 'none' }}
                    >
                      {hasEdits ? 'Approve as Edited' : 'Approve'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      color="primary"
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleStartEdit(pendingApproval)}
                      disabled={!!isMutating}
                      sx={{ textTransform: 'none' }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={isMutating ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                      onClick={() => handleApprove(pendingApproval.request_id)}
                      disabled={!!isMutating}
                      sx={{ textTransform: 'none' }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={isMutating ? <CircularProgress size={16} color="inherit" /> : <Cancel />}
                      onClick={() => handleRejectClick(pendingApproval.request_id)}
                      disabled={!!isMutating}
                      sx={{ textTransform: 'none' }}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </Box>
            ) : (
              rec.status !== 'DISMISSED' && rec.status !== 'AUTO_EXECUTED' && (
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  onClick={() => dismissMutation.mutate(rec.recommendation_id)}
                  disabled={dismissMutation.isPending}
                  sx={{ textTransform: 'none' }}
                >
                  Dismiss
                </Button>
              )
            )}
          </Box>
        </CardContent>
      </Card>
    )
  }

  const renderApprovalHistoryCard = (approval: ApprovalRequest) => {
    const actionCfg = ACTION_CONFIG[approval.action_type] || {
      label: approval.action_type.replace(/_/g, ' '),
      icon: <PlayArrow fontSize="small" />,
      color: '#666',
    }
    const executionSteps = getExecutionPlan(approval)
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

          <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
            {approval.description}
          </Typography>

          <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, borderLeft: '3px solid', borderColor: 'primary.main' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
              Agent Reasoning
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {approval.agent_reasoning}
            </Typography>
          </Box>

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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Recommendations & Approvals
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Agent-generated recommendations and actions requiring human approval
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label={`Recommendations (${recommendations.length})`} />
          <Tab label={`Approval History (${historyApprovals.length})`} />
        </Tabs>
      </Box>

      {/* Tab 0: Recommendations (with inline approval actions) */}
      {activeTab === 0 && (
        recommendations.length === 0 ? (
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
              {items.map(renderRecommendationCard)}
            </Box>
          ))
        )
      )}

      {/* Tab 1: Approval History */}
      {activeTab === 1 && (
        historyApprovals.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              No approval history yet
            </Typography>
          </Box>
        ) : (
          historyApprovals.map(renderApprovalHistoryCard)
        )
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

export default Recommendations
