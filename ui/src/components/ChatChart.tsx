import { Box, Typography, Alert } from '@mui/material'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ChartData } from '../types/chart'

const DEFAULT_COLORS = ['#0070F2', '#36A41D', '#E76500', '#CC1919', '#7B61FF', '#0891B2']

const formatYAxis = (value: number) => {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

const formatTooltipValue = (value: number) => `$${value.toLocaleString()}`

const ChatChart = ({ data }: { data: ChartData }) => {
  if (!data.data || data.data.length === 0) {
    return <Alert severity="warning" sx={{ my: 1 }}>No chart data available</Alert>
  }

  const { type, title, config } = data
  const colors = config.colors || {}

  const getColor = (key: string, index: number) =>
    colors[key] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]

  return (
    <Box sx={{ my: 2 }}>
      {title && (
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>{title}</Typography>
      )}
      <ResponsiveContainer width="100%" height={280}>
        {type === 'line' ? (
          <LineChart data={data.data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey={config.xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatYAxis} />
            <Tooltip formatter={formatTooltipValue} contentStyle={{ borderRadius: 8, border: '1px solid #E0E0E0' }} />
            <Legend />
            {(config.yKeys || []).map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={getColor(key, i)} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        ) : type === 'bar' ? (
          <BarChart data={data.data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey={config.xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatYAxis} />
            <Tooltip formatter={formatTooltipValue} contentStyle={{ borderRadius: 8, border: '1px solid #E0E0E0' }} />
            <Legend />
            {(config.yKeys || []).map((key, i) => (
              <Bar key={key} dataKey={key} fill={getColor(key, i)} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : (
          <PieChart>
            <Pie
              data={data.data}
              dataKey={config.dataKey || 'value'}
              nameKey={config.nameKey || 'name'}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.data.map((_, i) => (
                <Cell key={i} fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={formatTooltipValue} contentStyle={{ borderRadius: 8, border: '1px solid #E0E0E0' }} />
            <Legend />
          </PieChart>
        )}
      </ResponsiveContainer>
    </Box>
  )
}

export default ChatChart
