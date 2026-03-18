import { useState } from 'react'
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Button,
} from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ApprovalCard from '../components/ApprovalCard'
import StatusBadge from '../components/StatusBadge'
import { getApprovals, approveRequest, rejectRequest } from '../api/bigquery'

const Approvals = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const queryClient = useQueryClient()

  const { data: approvals = [], isLoading, isError } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => getApprovals(),
    refetchInterval: 5000,
  })

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveRequest(requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      rejectRequest(requestId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      setRejectDialogOpen(false)
      setRejectReason('')
    },
  })

  const handleApprove = (requestId: string) => {
    approveMutation.mutate(requestId)
  }

  const handleRejectClick = (requestId: string) => {
    setRejectingId(requestId)
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
              />
            ))
          )}
        </Box>
      )}

      {activeTab === 1 && (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E0E0E0' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Request ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Action Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Amount</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Decided By</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historyApprovals.map(approval => (
                <TableRow key={approval.request_id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {approval.request_id}
                  </TableCell>
                  <TableCell>{approval.action_type}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCurrency(approval.amount, approval.currency)}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 400 }}>
                    <Typography variant="body2" noWrap>
                      {approval.description}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatTimestamp(approval.requested_at)}</TableCell>
                  <TableCell>
                    <StatusBadge status={approval.status} />
                  </TableCell>
                  <TableCell>
                    {approval.approved_by || '-'}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>
                    <Typography variant="body2" noWrap>
                      {approval.rejection_reason || '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
    </Box>
  )
}

export default Approvals
