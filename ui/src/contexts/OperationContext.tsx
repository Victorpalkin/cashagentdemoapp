import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { resetDemo, runDailyReview } from '../api/bigquery'

type OperationStatus = 'idle' | 'resetting' | 'reviewing' | 'done' | 'error'

interface OperationState {
  status: OperationStatus
  message: string
  recommendationsCreated?: number
}

interface OperationContextValue {
  state: OperationState
  startReset: (full: boolean) => void
  dismiss: () => void
}

const OperationContext = createContext<OperationContextValue | null>(null)

export const useOperation = () => {
  const ctx = useContext(OperationContext)
  if (!ctx) throw new Error('useOperation must be used within OperationProvider')
  return ctx
}

export const OperationProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient()
  const [state, setState] = useState<OperationState>({ status: 'idle', message: '' })

  const startReset = useCallback(async (full: boolean) => {
    setState({ status: 'resetting', message: full ? 'Regenerating seed data...' : 'Clearing operational tables...' })

    try {
      await resetDemo(full)
      queryClient.invalidateQueries()
    } catch (err) {
      setState({ status: 'error', message: `Reset failed: ${err instanceof Error ? err.message : String(err)}` })
      return
    }

    setState({ status: 'reviewing', message: 'Running agent review...' })

    try {
      const result = await runDailyReview()
      queryClient.invalidateQueries()
      const count = result.recommendations_created || 0
      setState({
        status: 'done',
        message: `Complete — ${count} recommendation${count !== 1 ? 's' : ''} created`,
        recommendationsCreated: count,
      })
    } catch (err) {
      setState({ status: 'error', message: `Agent review failed: ${err instanceof Error ? err.message : String(err)}` })
    }
  }, [queryClient])

  const dismiss = useCallback(() => {
    setState({ status: 'idle', message: '' })
  }, [])

  return (
    <OperationContext.Provider value={{ state, startReset, dismiss }}>
      {children}
    </OperationContext.Provider>
  )
}
