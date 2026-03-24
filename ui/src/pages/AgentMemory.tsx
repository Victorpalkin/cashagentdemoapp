import { useState } from 'react'
import {
  Box, Typography, Card, CardContent, Chip, Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, IconButton,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Psychology as PsychologyIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMemories, createMemory, deactivateMemory, MemoryEntry } from '../api/bigquery'

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  COUNTERPARTY: { label: 'Counterparty', color: '#0070F2' },
  INSTRUMENT: { label: 'Instrument', color: '#7B61FF' },
  POLICY_OVERRIDE: { label: 'Policy Override', color: '#E76500' },
  PREFERENCE: { label: 'Preference', color: '#36A41D' },
}

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  REJECTION: { label: 'Rejection', color: '#D32F2F' },
  EDIT: { label: 'Edit', color: '#ED6C02' },
  MANUAL: { label: 'Manual', color: '#757575' },
}

const CATEGORIES = ['COUNTERPARTY', 'INSTRUMENT', 'POLICY_OVERRIDE', 'PREFERENCE']
const ACTION_TYPES = ['PLACE_DEPOSIT', 'HEDGE_FX', 'ACCELERATE_COLLECTION', '']

const AgentMemory = () => {
  const queryClient = useQueryClient()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newMemory, setNewMemory] = useState({
    content: '', category: 'PREFERENCE', related_action_type: '', related_entity: '',
  })

  const { data: memories = [], isLoading, isError } = useQuery({
    queryKey: ['memories'],
    queryFn: getMemories,
    refetchInterval: 10000,
  })

  const createMutation = useMutation({
    mutationFn: (data: { content: string; category: string; source: string; related_action_type?: string; related_entity?: string }) =>
      createMemory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
      setAddDialogOpen(false)
      setNewMemory({ content: '', category: 'PREFERENCE', related_action_type: '', related_entity: '' })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (memoryId: string) => deactivateMemory(memoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    },
  })

  const handleCreate = () => {
    const data: any = {
      content: newMemory.content,
      category: newMemory.category,
      source: 'MANUAL',
    }
    if (newMemory.related_action_type) data.related_action_type = newMemory.related_action_type
    if (newMemory.related_entity) data.related_entity = newMemory.related_entity
    createMutation.mutate(data)
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
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
        <Alert severity="error">Failed to load agent memories</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Agent Memory
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Learned patterns from human approval decisions that influence future recommendations
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddDialogOpen(true)}
        >
          Add Memory
        </Button>
      </Box>

      {memories.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <PsychologyIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No memories yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Memories are created when you reject or edit recommendations, or added manually.
          </Typography>
        </Box>
      ) : (
        memories.map((memory: MemoryEntry) => {
          const catCfg = CATEGORY_CONFIG[memory.category] || { label: memory.category, color: '#666' }
          const srcCfg = SOURCE_CONFIG[memory.source] || { label: memory.source, color: '#666' }

          return (
            <Card
              key={memory.memory_id}
              elevation={0}
              sx={{ mb: 2, border: '1px solid #E0E0E0' }}
            >
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={catCfg.label}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        bgcolor: `${catCfg.color}14`,
                        color: catCfg.color,
                        border: `1px solid ${catCfg.color}40`,
                      }}
                    />
                    <Chip
                      label={srcCfg.label}
                      size="small"
                      variant="outlined"
                      sx={{ color: srcCfg.color, borderColor: srcCfg.color }}
                    />
                    {memory.related_action_type && (
                      <Chip
                        label={memory.related_action_type.replace(/_/g, ' ')}
                        size="small"
                        variant="outlined"
                        sx={{ color: '#666' }}
                      />
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => deactivateMutation.mutate(memory.memory_id)}
                    disabled={deactivateMutation.isPending}
                    title="Deactivate"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>

                <Typography variant="body1" sx={{ mb: 1.5, lineHeight: 1.7 }}>
                  {memory.content}
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  {memory.related_entity && (
                    <Typography variant="caption" color="text.secondary">
                      Entity: <strong>{memory.related_entity}</strong>
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {memory.memory_id}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatTimestamp(memory.created_at)} by {memory.created_by}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )
        })
      )}

      {/* Add Memory Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Agent Memory</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Content"
            fullWidth
            multiline
            rows={3}
            value={newMemory.content}
            onChange={(e) => setNewMemory(m => ({ ...m, content: e.target.value }))}
          />
          <TextField
            select
            margin="dense"
            label="Category"
            fullWidth
            value={newMemory.category}
            onChange={(e) => setNewMemory(m => ({ ...m, category: e.target.value }))}
          >
            {CATEGORIES.map(c => (
              <MenuItem key={c} value={c}>{CATEGORY_CONFIG[c]?.label || c}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            margin="dense"
            label="Related Action Type (optional)"
            fullWidth
            value={newMemory.related_action_type}
            onChange={(e) => setNewMemory(m => ({ ...m, related_action_type: e.target.value }))}
          >
            <MenuItem value="">None</MenuItem>
            {ACTION_TYPES.filter(Boolean).map(a => (
              <MenuItem key={a} value={a}>{a.replace(/_/g, ' ')}</MenuItem>
            ))}
          </TextField>
          <TextField
            margin="dense"
            label="Related Entity (optional)"
            fullWidth
            value={newMemory.related_entity}
            onChange={(e) => setNewMemory(m => ({ ...m, related_entity: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={!newMemory.content.trim() || createMutation.isPending}
          >
            Add Memory
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default AgentMemory
