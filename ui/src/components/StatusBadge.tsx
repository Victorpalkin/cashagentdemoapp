import { Chip } from '@mui/material'

export type StatusType = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIGH' | 'MEDIUM' | 'LOW' | 'COMPLETED' | 'OVERDUE'

interface StatusBadgeProps {
  status: StatusType
  size?: 'small' | 'medium'
}

const StatusBadge = ({ status, size = 'small' }: StatusBadgeProps) => {
  const getColor = () => {
    switch (status) {
      case 'APPROVED':
      case 'LOW':
      case 'COMPLETED':
        return 'success'
      case 'PENDING':
      case 'MEDIUM':
        return 'warning'
      case 'REJECTED':
      case 'HIGH':
      case 'OVERDUE':
        return 'error'
      default:
        return 'default'
    }
  }

  return (
    <Chip
      label={status}
      color={getColor()}
      size={size}
      sx={{
        fontWeight: 600,
        minWidth: 80,
        height: size === 'small' ? 24 : 32,
      }}
    />
  )
}

export default StatusBadge
