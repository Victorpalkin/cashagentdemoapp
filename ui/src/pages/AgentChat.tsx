import { useState, useRef, useEffect, useCallback } from 'react'
import { Box, Typography, Card, Paper, TextField, Button, Avatar, IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material'
import { Send, MoreVert, Description, Code, PictureAsPdf, Article } from '@mui/icons-material'
import ReactMarkdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { sendChatMessage, ChatImage } from '../api/bigquery'
import ChatChart from '../components/ChatChart'
import { ChartData } from '../types/chart'
import { exportAsMarkdown, exportAsHTML, exportAsPDF, exportAsDOCX } from '../utils/messageExport'

const markdownComponents: Components = {
  p: ({ children }) => (
    <Typography variant="body2" sx={{ mb: 1, '&:last-child': { mb: 0 } }}>{children}</Typography>
  ),
  h1: ({ children }) => (
    <Typography variant="h6" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>{children}</Typography>
  ),
  h2: ({ children }) => (
    <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>{children}</Typography>
  ),
  h3: ({ children }) => (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>{children}</Typography>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1 }}>{children}</Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ m: 0, pl: 2.5, mb: 1 }}>{children}</Box>
  ),
  li: ({ children }) => (
    <Typography component="li" variant="body2" sx={{ mb: 0.25 }}>{children}</Typography>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.startsWith('language-')
    const language = className?.replace('language-', '')

    if (language === 'chart') {
      try {
        const chartData: ChartData = JSON.parse(String(children).trim())
        return <ChatChart data={chartData} />
      } catch {
        return (
          <Box sx={{ color: 'error.main', fontSize: '0.85rem', my: 1 }}>
            Invalid chart data
          </Box>
        )
      }
    }

    return isBlock ? (
      <Box component="pre" sx={{
        bgcolor: '#1E1E1E', color: '#D4D4D4', p: 1.5, borderRadius: 1,
        overflow: 'auto', fontSize: '0.8rem', fontFamily: 'monospace', mb: 1,
      }}>
        <code>{children}</code>
      </Box>
    ) : (
      <Box component="code" sx={{
        bgcolor: 'grey.100', px: 0.5, borderRadius: 0.5,
        fontSize: '0.85em', fontFamily: 'monospace',
      }}>
        {children}
      </Box>
    )
  },
  table: ({ children }) => (
    <Box component="table" sx={{
      borderCollapse: 'collapse', width: '100%', mb: 1, fontSize: '0.85rem',
      '& th, & td': { border: '1px solid #E0E0E0', px: 1, py: 0.5, textAlign: 'left' },
      '& th': { bgcolor: 'grey.100', fontWeight: 600 },
    }}>
      {children}
    </Box>
  ),
  strong: ({ children }) => (
    <Box component="strong" sx={{ fontWeight: 700 }}>{children}</Box>
  ),
  blockquote: ({ children }) => (
    <Box sx={{ borderLeft: '3px solid', borderColor: 'primary.main', pl: 1.5, my: 1, color: 'text.secondary' }}>
      {children}
    </Box>
  ),
  hr: () => <Box component="hr" sx={{ border: 'none', borderTop: '1px solid #E0E0E0', my: 1.5 }} />,
}

interface Message {
  id: string
  sender: 'user' | 'agent'
  text: string
  images?: ChatImage[]
  timestamp: string
}

const AgentChat = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [exportMenu, setExportMenu] = useState<{ anchorEl: HTMLElement; messageId: string } | null>(null)

  const setMessageRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    messageRefs.current[id] = el
  }, [])

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
      const { response, images } = await sendChatMessage(inputText)
      setMessages(prev =>
        prev.map(m =>
          m.id === thinkingId
            ? { ...m, text: response, images, timestamp: new Date().toISOString() }
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
                '&:hover .export-btn': { opacity: 1 },
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
                    ref={message.sender === 'agent' ? setMessageRef(message.id) : undefined}
                    sx={{
                      p: 2,
                      bgcolor: message.sender === 'user' ? 'primary.main' : 'background.paper',
                      color: message.sender === 'user' ? 'white' : 'text.primary',
                      borderRadius: 2,
                      border: message.sender === 'agent' ? '1px solid #E0E0E0' : 'none',
                      position: 'relative',
                    }}
                  >
                    {message.sender === 'agent' && message.text !== 'Thinking...' && (
                      <IconButton
                        className="export-btn"
                        size="small"
                        onClick={(e) => setExportMenu({ anchorEl: e.currentTarget, messageId: message.id })}
                        sx={{
                          position: 'absolute', top: 4, right: 4,
                          opacity: 0, transition: 'opacity 0.2s',
                          bgcolor: 'background.paper', '&:hover': { bgcolor: 'grey.100' },
                        }}
                      >
                        <MoreVert fontSize="small" />
                      </IconButton>
                    )}
                    {message.sender === 'agent' ? (
                      <>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {message.text}
                        </ReactMarkdown>
                        {message.images?.map((img, i) => (
                          <Box key={i} sx={{ mt: 1.5 }}>
                            <img
                              src={`data:${img.mime_type};base64,${img.data}`}
                              alt="Chart"
                              style={{ maxWidth: '100%', borderRadius: 8 }}
                            />
                          </Box>
                        ))}
                      </>
                    ) : (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {message.text}
                      </Typography>
                    )}
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

        {/* Export Menu */}
        <Menu
          anchorEl={exportMenu?.anchorEl}
          open={!!exportMenu}
          onClose={() => setExportMenu(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={() => {
            const msg = messages.find(m => m.id === exportMenu?.messageId)
            if (msg) exportAsMarkdown(msg)
            setExportMenu(null)
          }}>
            <ListItemIcon><Code fontSize="small" /></ListItemIcon>
            <ListItemText>Markdown</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => {
            const msg = messages.find(m => m.id === exportMenu?.messageId)
            if (msg) exportAsHTML(msg)
            setExportMenu(null)
          }}>
            <ListItemIcon><Article fontSize="small" /></ListItemIcon>
            <ListItemText>HTML</ListItemText>
          </MenuItem>
          <MenuItem onClick={async () => {
            const el = messageRefs.current[exportMenu?.messageId || '']
            if (el) await exportAsPDF(el)
            setExportMenu(null)
          }}>
            <ListItemIcon><PictureAsPdf fontSize="small" /></ListItemIcon>
            <ListItemText>PDF</ListItemText>
          </MenuItem>
          <MenuItem onClick={async () => {
            const msg = messages.find(m => m.id === exportMenu?.messageId)
            if (msg) await exportAsDOCX(msg)
            setExportMenu(null)
          }}>
            <ListItemIcon><Description fontSize="small" /></ListItemIcon>
            <ListItemText>Word</ListItemText>
          </MenuItem>
        </Menu>

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
