import { useState, useRef, useEffect } from 'react'
import { Box, Typography, Card, Paper, TextField, Button, Avatar } from '@mui/material'
import { Send } from '@mui/icons-material'
import { sendChatMessage } from '../api/bigquery'

interface Message {
  id: string
  sender: 'user' | 'agent'
  text: string
  timestamp: string
}

const AgentChat = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!inputText.trim() || loading) return

    const userMessage: Message = {
      id: String(Date.now()),
      sender: 'user',
      text: inputText,
      timestamp: new Date().toISOString(),
    }

    const thinkingId = String(Date.now() + 1)
    const thinkingMessage: Message = {
      id: thinkingId,
      sender: 'agent',
      text: 'Thinking...',
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage, thinkingMessage])
    setInputText('')
    setLoading(true)

    try {
      const response = await sendChatMessage(inputText)
      setMessages(prev =>
        prev.map(m =>
          m.id === thinkingId
            ? { ...m, text: response, timestamp: new Date().toISOString() }
            : m
        )
      )
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === thinkingId
            ? { ...m, text: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`, timestamp: new Date().toISOString() }
            : m
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Agent Chat
      </Typography>

      <Card sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Messages Area */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
          {messages.length === 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography color="text.secondary">
                Ask about cash positions, forecasts, anomalies, or request actions...
              </Typography>
            </Box>
          )}
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                mb: 2,
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, maxWidth: '70%', alignItems: 'flex-start' }}>
                {message.sender === 'agent' && (
                  <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                    AI
                  </Avatar>
                )}
                <Box>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: message.sender === 'user' ? 'primary.main' : 'background.paper',
                      color: message.sender === 'user' ? 'white' : 'text.primary',
                      borderRadius: 2,
                      border: message.sender === 'agent' ? '1px solid #E0E0E0' : 'none',
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {message.text}
                    </Typography>
                  </Paper>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {formatTimestamp(message.timestamp)}
                  </Typography>
                </Box>
                {message.sender === 'user' && (
                  <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                    SC
                  </Avatar>
                )}
              </Box>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input Area */}
        <Box sx={{ p: 2, borderTop: '1px solid #E0E0E0', bgcolor: 'background.default' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Ask about cash positions, forecasts, or request actions..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              multiline
              maxRows={3}
              disabled={loading}
            />
            <Button
              variant="contained"
              endIcon={<Send />}
              onClick={handleSend}
              disabled={!inputText.trim() || loading}
            >
              Send
            </Button>
          </Box>
        </Box>
      </Card>
    </Box>
  )
}

export default AgentChat
