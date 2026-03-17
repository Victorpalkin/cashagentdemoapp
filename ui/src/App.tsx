import { Routes, Route, Navigate } from 'react-router-dom'
import { Box } from '@mui/material'
import Shell from './components/Shell'
import Dashboard from './pages/Dashboard'
import Approvals from './pages/Approvals'
import AuditTrail from './pages/AuditTrail'
import AgentChat from './pages/AgentChat'

function App() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Shell />
      <Box component="main" sx={{ flexGrow: 1, overflow: 'auto', bgcolor: 'background.default' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/chat" element={<AgentChat />} />
        </Routes>
      </Box>
    </Box>
  )
}

export default App
