import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Box, LinearProgress, Typography, Alert, Snackbar } from '@mui/material'
import { SmartToy as SmartToyIcon } from '@mui/icons-material'
import Shell from './components/Shell'
import Dashboard from './pages/Dashboard'
import Recommendations from './pages/Recommendations'
import AuditTrail from './pages/AuditTrail'
import Executions from './pages/Executions'
import AgentChat from './pages/AgentChat'
import AgentMemory from './pages/AgentMemory'
import Anomalies from './pages/Anomalies'
import Architecture from './pages/Architecture'
import Policies from './pages/Policies'
import { useOperation } from './contexts/OperationContext'

function App() {
  const { state: opState, dismiss } = useOperation()
  const isBusy = opState.status === 'resetting' || opState.status === 'reviewing'

  useEffect(() => {
    if (opState.status === 'done' || opState.status === 'error') {
      const timer = setTimeout(dismiss, 6000)
      return () => clearTimeout(timer)
    }
  }, [opState.status, dismiss])

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Shell />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isBusy && (
          <Box sx={{ bgcolor: 'primary.main', color: 'white', px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            <SmartToyIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {opState.message}
            </Typography>
            <Box sx={{ flexGrow: 1 }}>
              <LinearProgress
                color="inherit"
                sx={{ height: 3, borderRadius: 1, opacity: 0.6 }}
              />
            </Box>
          </Box>
        )}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/anomalies" element={<Anomalies />} />
            <Route path="/approvals" element={<Navigate to="/recommendations" replace />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/executions" element={<Executions />} />
            <Route path="/audit" element={<AuditTrail />} />
            <Route path="/memory" element={<AgentMemory />} />
            <Route path="/chat" element={<AgentChat />} />
            <Route path="/architecture" element={<Architecture />} />
            <Route path="/policies" element={<Policies />} />
          </Routes>
        </Box>
      </Box>

      <Snackbar
        open={opState.status === 'done' || opState.status === 'error'}
        autoHideDuration={6000}
        onClose={dismiss}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={opState.status === 'error' ? 'error' : 'success'}
          onClose={dismiss}
        >
          {opState.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default App
