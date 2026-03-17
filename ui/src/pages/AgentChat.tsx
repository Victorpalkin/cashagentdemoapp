import { useState } from 'react'
import { Box, Typography, Card, Paper, TextField, Button, Avatar, Alert } from '@mui/material'
import { Send, Info } from '@mui/icons-material'

interface Message {
  id: string
  sender: 'user' | 'agent'
  text: string
  timestamp: string
}

const mockConversation: Message[] = [
  {
    id: '1',
    sender: 'user',
    text: "What's our cash position today?",
    timestamp: '2026-03-16T09:00:00Z',
  },
  {
    id: '2',
    sender: 'agent',
    text: "Here's your current cash position across all currencies:\n\n• USD: $11,100,000\n• EUR: €6,800,000 ($7,344,000 USD equivalent)\n• GBP: £3,100,000 ($3,937,000 USD equivalent)\n\nTotal: $22,381,000 USD\n\nYour USD position is up 2.3% vs. last week, while EUR is down 1.2%. Overall liquidity is healthy and above minimum reserve requirements.",
    timestamp: '2026-03-16T09:00:15Z',
  },
  {
    id: '3',
    sender: 'user',
    text: 'Do we have any payments due this week?',
    timestamp: '2026-03-16T09:02:00Z',
  },
  {
    id: '4',
    sender: 'agent',
    text: "Yes, you have 5 payments scheduled for this week:\n\n1. ACME Corp (AP) - €2,300,000 due Mar 18\n2. Global Suppliers Ltd (AP) - £850,000 due Mar 20\n3. Manufacturing Partners (AP) - €1,200,000 due Mar 22\n\nAlso expecting 2 receivables:\n4. TechVentures Inc (AR) - $1,500,000 due Mar 19\n5. RetailChain Co (AR) - $2,100,000 due Mar 21\n\nNote: There's 1 overdue payment to a vendor for $450K that requires immediate attention.",
    timestamp: '2026-03-16T09:02:20Z',
  },
  {
    id: '5',
    sender: 'user',
    text: 'Should we hedge the ACME Corp payment?',
    timestamp: '2026-03-16T09:05:00Z',
  },
  {
    id: '6',
    sender: 'agent',
    text: "Yes, I recommend hedging the €2.3M ACME Corp payment. Here's my analysis:\n\n**Payment Probability**: 92% (based on ACME's payment history)\n**Current EUR/USD Volatility**: 1.8% (elevated)\n**Current Rate**: 1.08\n**Exposure**: €2.3M = $2,484,000 USD\n\n**Recommendation**: Execute FX hedge now\n- Locks in favorable 1.08 rate\n- Eliminates FX risk on this obligation\n- Cost: ~$8,500 in hedge fees\n- Benefit: Protects against potential 2-3% adverse move\n\nI've created approval request APR-001 for your review. Would you like me to proceed?",
    timestamp: '2026-03-16T09:05:30Z',
  },
]

const AgentChat = () => {
  const [messages, setMessages] = useState<Message[]>(mockConversation)
  const [inputText, setInputText] = useState('')

  const handleSend = () => {
    if (!inputText.trim()) return

    const newMessage: Message = {
      id: String(messages.length + 1),
      sender: 'user',
      text: inputText,
      timestamp: new Date().toISOString(),
    }

    setMessages([...messages, newMessage])
    setInputText('')

    // Simulate agent response
    setTimeout(() => {
      const agentResponse: Message = {
        id: String(messages.length + 2),
        sender: 'agent',
        text: "I'm processing your request. This is a demo interface, so I can only show pre-loaded conversations. In production, I would connect to the actual agent backend to provide real-time responses.",
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, agentResponse])
    }, 1000)
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

      <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
        This is a demo conversation preview. For live agent interaction, use the{' '}
        <strong>Agent Chat App</strong> (<code>adk web</code> or the deployed chat-app service).
      </Alert>

      <Card sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Messages Area */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
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
            />
            <Button
              variant="contained"
              endIcon={<Send />}
              onClick={handleSend}
              disabled={!inputText.trim()}
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
