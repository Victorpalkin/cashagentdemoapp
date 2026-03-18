import { Chip } from '@mui/material'

export type StatusType =
  | 'PENDING' | 'APPROVED' | 'REJECTED'
  | 'HIGH' | 'MEDIUM' | 'LOW'
  | 'COMPLETED' | 'OVERDUE'
  | 'RECOMMENDED' | 'PENDING_APPROVAL' | 'AUTO_EXECUTED' | 'DISMISSED'

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
      case 'AUTO_EXECUTED':
        return 'success'
      case 'PENDING':
      case 'MEDIUM':
      case 'PENDING_APPROVAL':
        return 'warning'
      case 'REJECTED':
      case 'HIGH':
      case 'OVERDUE':
        return 'error'
      case 'RECOMMENDED':
        return 'info'
      case 'DISMISSED':
        return 'default'
      default:
        return 'default'
    }
  }

  const getLabel = () => {
    switch (status) {
      case 'PENDING_APPROVAL': return 'PENDING APPROVAL'
      case 'AUTO_EXECUTED': return 'AUTO-EXECUTED'
      default: return status
    }
  }

  return (
    <Chip
      label={getLabel()}
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
