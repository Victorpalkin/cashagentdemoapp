import { useState } from 'react'
import {
  Typography, IconButton, Box, Badge,
  Menu, MenuItem, ListItemIcon, ListItemText, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Button, Snackbar, Alert, CircularProgress,
  Drawer, List, ListSubheader, ListItemButton, Divider,
} from '@mui/material'
import {
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  RestartAlt as ResetIcon,
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon,
  Warning as WarningIcon,
  Lightbulb as LightbulbIcon,
  PlayCircle as PlayCircleIcon,
  Chat as ChatIcon,
  Psychology as PsychologyIcon,
  History as HistoryIcon,
  AccountTree as AccountTreeIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { resetDemo, getApprovals } from '../api/bigquery'

const DRAWER_WIDTH = 240

const navSections = [
  {
    label: 'Operations',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
      { label: 'Anomalies', path: '/anomalies', icon: WarningIcon },
      { label: 'Recommendations', path: '/recommendations', icon: LightbulbIcon, badge: true },
      { label: 'Executions', path: '/executions', icon: PlayCircleIcon },
    ],
  },
  {
    label: 'Agent',
    items: [
      { label: 'Agent Chat', path: '/chat', icon: ChatIcon },
      { label: 'Memory', path: '/memory', icon: PsychologyIcon },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Audit Trail', path: '/audit', icon: HistoryIcon },
      { label: 'Policies', path: '/policies', icon: DescriptionIcon },
      { label: 'Architecture', path: '/architecture', icon: AccountTreeIcon },
    ],
  },
]

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

  const handleResetClick = (full: boolean) => {
    setSettingsAnchor(null)
    setConfirmDialog({ open: true, full })
  }

  const handleResetConfirm = () => {
    const full = confirmDialog.full
    setConfirmDialog({ open: false, full: false })
    resetMutation.mutate(full)
  }

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: 'secondary.main',
            borderRight: '1px solid rgba(255,255,255,0.12)',
          },
        }}
      >
        {/* App Title + Actions */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>
            Cash Agent
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              sx={{ color: 'rgba(255,255,255,0.7)' }}
              onClick={(e) => setSettingsAnchor(e.currentTarget)}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <SettingsIcon fontSize="small" />
              )}
            </IconButton>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.7)' }} onClick={() => { if (pendingCount > 0) navigate('/approvals') }}>
              <Badge badgeContent={pendingCount > 0 ? pendingCount : undefined} color="error">
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Box>
        </Box>

        {/* Nav Sections */}
        {navSections.map((section, sIdx) => (
          <Box key={section.label}>
            {sIdx > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />}
            <List
              dense
              subheader={
                <ListSubheader
                  sx={{
                    bgcolor: 'transparent',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    lineHeight: '32px',
                    mt: 1,
                  }}
                >
                  {section.label}
                </ListSubheader>
              }
            >
              {section.items.map((item) => {
                const active = isActive(item.path)
                const Icon = item.icon
                return (
                  <ListItemButton
                    key={item.path}
                    selected={active}
                    onClick={() => navigate(item.path)}
                    sx={{
                      mx: 1,
                      borderRadius: 1,
                      mb: 0.25,
                      color: active ? 'white' : 'rgba(255,255,255,0.7)',
                      borderLeft: active ? '3px solid' : '3px solid transparent',
                      borderColor: active ? 'primary.main' : 'transparent',
                      bgcolor: active ? 'rgba(0,112,242,0.12)' : 'transparent',
                      '&:hover': {
                        bgcolor: active ? 'rgba(0,112,242,0.18)' : 'rgba(255,255,255,0.08)',
                      },
                      '&.Mui-selected': {
                        bgcolor: 'rgba(0,112,242,0.12)',
                      },
                      '&.Mui-selected:hover': {
                        bgcolor: 'rgba(0,112,242,0.18)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
                      {item.badge ? (
                        <Badge badgeContent={pendingCount > 0 ? pendingCount : undefined} color="error">
                          <Icon fontSize="small" />
                        </Badge>
                      ) : (
                        <Icon fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: active ? 600 : 400 }}
                    />
                  </ListItemButton>
                )
              })}
            </List>
          </Box>
        ))}
      </Drawer>


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
              ? 'This will regenerate all seed data with today\'s dates, reload BigQuery tables, and clear operational tables. This may take ~30 seconds.'
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

export { DRAWER_WIDTH }
export default Shell
