import { AppBar, Toolbar, Typography, Avatar, IconButton, Tabs, Tab, Box, Badge } from '@mui/material'
import { Notifications as NotificationsIcon } from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'

const Shell = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const getActiveTab = () => {
    const path = location.pathname
    if (path.startsWith('/dashboard')) return 0
    if (path.startsWith('/approvals')) return 1
    if (path.startsWith('/audit')) return 2
    if (path.startsWith('/chat')) return 3
    return 0
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    const paths = ['/dashboard', '/approvals', '/audit', '/chat']
    navigate(paths[newValue])
  }

  return (
    <AppBar position="static" sx={{ bgcolor: 'secondary.main', boxShadow: 'none', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
      <Toolbar sx={{ minHeight: 64, px: 3 }}>
        {/* Left: App Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 0 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 700, color: 'white', mr: 4 }}>
            💰 Cash Agent Dashboard
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
            <Tab label="Approvals" />
            <Tab label="Audit Trail" />
            <Tab label="Agent Chat" />
          </Tabs>
        </Box>

        {/* Right: User Info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton color="inherit" size="small">
            <Badge badgeContent={3} color="error">
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
  )
}

export default Shell
