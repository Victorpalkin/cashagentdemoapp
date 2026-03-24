import { useState } from 'react'
import {
  AppBar, Toolbar, Typography, Avatar, IconButton, Tabs, Tab, Box, Badge,
  Menu, MenuItem, ListItemIcon, ListItemText, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Button, Snackbar, Alert, CircularProgress,
} from '@mui/material'
import {
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  RestartAlt as ResetIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { resetDemo, getApprovals } from '../api/bigquery'

const Shell = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; full: boolean }>({ open: false, full: false })
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  })

  const { data: approvals = [] } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => getApprovals(),
    refetchInterval: 10000,
  })
  const pendingCount = approvals.filter(a => a.status === 'PENDING').length

  const resetMutation = useMutation({
    mutationFn: (full: boolean) => resetDemo(full),
    onSuccess: (_data, full) => {
      queryClient.invalidateQueries()
      setSnackbar({
        open: true,
        message: full ? 'Full reset complete — seed data regenerated' : 'Quick reset complete — operational tables cleared',
        severity: 'success',
      })
    },
    onError: (err: Error) => {
      setSnackbar({ open: true, message: `Reset failed: ${err.message}`, severity: 'error' })
    },
  })

  const getActiveTab = () => {
    const path = location.pathname
    if (path.startsWith('/dashboard')) return 0
    if (path.startsWith('/recommendations')) return 1
    if (path.startsWith('/approvals')) return 2
    if (path.startsWith('/executions')) return 3
    if (path.startsWith('/audit')) return 4
    if (path.startsWith('/chat')) return 5
    if (path.startsWith('/architecture')) return 6
    return 0
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    const paths = ['/dashboard', '/recommendations', '/approvals', '/executions', '/audit', '/chat', '/architecture']
    navigate(paths[newValue])
  }

  const handleResetClick = (full: boolean) => {
    setSettingsAnchor(null)
    setConfirmDialog({ open: true, full })
  }

  const handleResetConfirm = () => {
    const full = confirmDialog.full
    setConfirmDialog({ open: false, full: false })
    resetMutation.mutate(full)
  }

  return (
    <>
      <AppBar position="static" sx={{ bgcolor: 'secondary.main', boxShadow: 'none', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <Toolbar sx={{ minHeight: 64, px: 3 }}>
          {/* Left: App Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 0 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, color: 'white', mr: 4 }}>
              Cash Agent Dashboard
            </Typography>
          </Box>

          {/* Center: Navigation Tabs */}
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <Tabs
              value={getActiveTab()}
              onChange={handleTabChange}
              textColor="inherit"
              indicatorColor="primary"
              sx={{
                '& .MuiTab-root': {
                  color: 'rgba(255,255,255,0.7)',
                  fontWeight: 500,
                  minWidth: 120,
                  '&.Mui-selected': {
                    color: 'white',
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#0070F2',
                  height: 3,
                },
              }}
            >
              <Tab label="Dashboard" />
              <Tab label="Recommendations" />
              <Tab label="Approvals" />
              <Tab label="Executions" />
              <Tab label="Audit Trail" />
              <Tab label="Agent Chat" />
              <Tab label="Architecture" />
            </Tabs>
          </Box>

          {/* Right: Settings + User Info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              color="inherit"
              size="small"
              onClick={(e) => setSettingsAnchor(e.currentTarget)}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SettingsIcon />
              )}
            </IconButton>
            <IconButton color="inherit" size="small" onClick={() => { if (pendingCount > 0) navigate('/approvals') }}>
              <Badge badgeContent={pendingCount > 0 ? pendingCount : undefined} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: 'white' }}>
                Sarah Chen
              </Typography>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
                SC
              </Avatar>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
      >
        <MenuItem onClick={() => handleResetClick(false)}>
          <ListItemIcon><ResetIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Quick Reset" secondary="Clear approvals, audit log, recommendations" />
        </MenuItem>
        <MenuItem onClick={() => handleResetClick(true)}>
          <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Full Reset" secondary="Regenerate seed data with today's dates" />
        </MenuItem>
      </Menu>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, full: false })}>
        <DialogTitle>{confirmDialog.full ? 'Full Demo Reset' : 'Quick Demo Reset'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmDialog.full
              ? 'This will regenerate all seed data with today\'s dates, reload BigQuery tables, retrain the BQML model, and clear operational tables. This may take ~30 seconds.'
              : 'This will clear the approval requests, audit log, and recommendations tables. Seed data will remain unchanged.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, full: false })}>Cancel</Button>
          <Button onClick={handleResetConfirm} color="error" variant="contained">
            {confirmDialog.full ? 'Full Reset' : 'Quick Reset'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default Shell
