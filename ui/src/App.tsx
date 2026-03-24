import { Routes, Route, Navigate } from 'react-router-dom'
import { Box, Toolbar } from '@mui/material'
import Shell, { DRAWER_WIDTH } from './components/Shell'
import Dashboard from './pages/Dashboard'
import Approvals from './pages/Approvals'
import Recommendations from './pages/Recommendations'
import AuditTrail from './pages/AuditTrail'
import Executions from './pages/Executions'
import AgentChat from './pages/AgentChat'
import AgentMemory from './pages/AgentMemory'
import Anomalies from './pages/Anomalies'
import Architecture from './pages/Architecture'

function App() {
  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Shell />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          bgcolor: 'background.default',
          ml: `${DRAWER_WIDTH}px`,
        }}
      >
        {/* Spacer for fixed AppBar */}
        <Toolbar sx={{ minHeight: 56 }} />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/executions" element={<Executions />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/memory" element={<AgentMemory />} />
          <Route path="/chat" element={<AgentChat />} />
          <Route path="/architecture" element={<Architecture />} />
        </Routes>
      </Box>
    </Box>
  )
}

export default App
