// API client for BigQuery backend via ui-api service

const API_BASE = import.meta.env.VITE_API_URL || ''

export interface CashPosition {
  currency: string
  balance: number
  usdEquivalent: number
  changePercent: number
}

export interface BankAccount {
  bank_account_id: string
  bank_name: string
  account_type: string
  currency: string
  current_balance: number
  usd_equivalent: number
  usd_rate: number | null
  last_updated: string
}

export interface CashPositionResponse {
  balances: BankAccount[]
  currencyTotals: CashPosition[]
  grandTotalUsd: number
}

export interface ForecastDataPoint {
  forecast_date: string
  currency: string
  net_cash_flow: number
  standard_error: number
  confidence_level: number
  lower_bound: number
  upper_bound: number
}

export interface ForecastResponse {
  forecasts: ForecastDataPoint[]
  horizon_days: number
  error?: string
}

export interface ARItem {
  ar_item_id: string
  customer_id: string
  customer_name: string
  invoice_number: string
  amount: number
  currency: string
  due_date: string
  probability: number
  description: string
}

export interface APItem {
  ap_item_id: string
  vendor_id: string
  vendor_name: string
  invoice_number: string
  amount: number
  currency: string
  due_date: string
  payment_method: string
  description: string
}

export interface Obligation {
  id: string
  date: string
  type: 'AR' | 'AP'
  counterparty: string
  amount: number
  currency: string
  probability?: number
  status: 'HIGH' | 'MEDIUM' | 'LOW' | 'OVERDUE'
}

export interface ApprovalRequest {
  request_id: string
  action_type: string
  amount: number
  currency: string
  description: string
  agent_reasoning: string
  requested_at: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approved_at?: string
  approved_by?: string
  rejection_reason?: string
}

export interface AuditLog {
  timestamp: string
  agent_name: string
  action: string
  tool_name: string
  input_summary: string
  output_summary: string
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const getCashPosition = async (): Promise<CashPositionResponse> => {
  return apiFetch<CashPositionResponse>('/api/cash-position')
}

export const getForecast = async (days: number = 30): Promise<ForecastResponse> => {
  return apiFetch<ForecastResponse>(`/api/forecast?days=${days}`)
}

export const getARItems = async (currency?: string): Promise<{ items: ARItem[] }> => {
  const params = currency ? `?currency=${currency}` : ''
  return apiFetch(`/api/ar-items${params}`)
}

export const getAPItems = async (currency?: string): Promise<{ items: APItem[] }> => {
  const params = currency ? `?currency=${currency}` : ''
  return apiFetch(`/api/ap-items${params}`)
}

export const getObligations = async (): Promise<Obligation[]> => {
  const [arResp, apResp] = await Promise.all([getARItems(), getAPItems()])
  const today = new Date()

  const obligations: Obligation[] = []

  for (const item of arResp.items) {
    const dueDate = new Date(item.due_date)
    let status: Obligation['status'] = 'HIGH'
    if (item.probability < 0.6) status = 'LOW'
    else if (item.probability < 0.85) status = 'MEDIUM'
    if (dueDate < today) status = 'OVERDUE'

    obligations.push({
      id: item.ar_item_id,
      date: item.due_date,
      type: 'AR',
      counterparty: item.customer_name,
      amount: item.amount,
      currency: item.currency,
      probability: item.probability,
      status,
    })
  }

  for (const item of apResp.items) {
    const dueDate = new Date(item.due_date)
    const daysUntil = Math.floor((dueDate.getTime() - today.getTime()) / 86400000)
    let status: Obligation['status'] = daysUntil <= 3 ? 'HIGH' : daysUntil <= 7 ? 'MEDIUM' : 'LOW'
    if (dueDate < today) status = 'OVERDUE'

    obligations.push({
      id: item.ap_item_id,
      date: item.due_date,
      type: 'AP',
      counterparty: item.vendor_name,
      amount: item.amount,
      currency: item.currency,
      status,
    })
  }

  obligations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return obligations
}

export const getApprovals = async (status?: string): Promise<ApprovalRequest[]> => {
  const params = status ? `?status=${status}` : ''
  const resp = await apiFetch<{ approvals: ApprovalRequest[] }>(`/api/approvals${params}`)
  return resp.approvals
}

export const approveRequest = async (requestId: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/api/approvals/${requestId}/approve`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Approve failed: ${res.status}`)
  }
}

export const rejectRequest = async (requestId: string, reason: string): Promise<void> => {
  const res = await fetch(
    `${API_BASE}/api/approvals/${requestId}/reject?reason=${encodeURIComponent(reason)}`,
    { method: 'POST' }
  )
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Reject failed: ${res.status}`)
  }
}

export const getAuditLog = async (limit: number = 50): Promise<AuditLog[]> => {
  const resp = await apiFetch<{ entries: AuditLog[] }>(`/api/audit-log?limit=${limit}`)
  return resp.entries
}

// ---- Recommendations ----

export interface Recommendation {
  recommendation_id: string
  created_at: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  action_type: string
  amount: number
  currency: string
  description: string
  rationale: string
  status: string
  approval_request_id: string
}

export const getRecommendations = async (): Promise<Recommendation[]> => {
  const resp = await apiFetch<{ recommendations: Recommendation[] }>('/api/recommendations')
  return resp.recommendations
}

export const dismissRecommendation = async (recommendationId: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/api/recommendations/${recommendationId}/dismiss`, { method: 'POST' })
  if (!res.ok) throw new Error(`Dismiss failed: ${res.status}`)
}

// ---- FX Rates ----

export interface FxRate {
  from_currency: string
  to_currency: string
  exchange_rate: number
  rate_date: string
}

export const getFxRates = async (): Promise<FxRate[]> => {
  const resp = await apiFetch<{ rates: FxRate[] }>('/api/fx-rates')
  return resp.rates
}

// ---- Payment Runs ----

export interface PaymentRun {
  payment_run_id: string
  scheduled_date: string
  total_amount: number
  currency: string
  item_count: number
  status: string
  description: string
}

export const getPaymentRuns = async (): Promise<PaymentRun[]> => {
  const resp = await apiFetch<{ payment_runs: PaymentRun[] }>('/api/payment-runs')
  return resp.payment_runs
}

// ---- Executions ----

export interface Execution {
  timestamp: string
  agent_name: string
  tool_name: string
  input_summary: string
  output_summary: string
  details: Record<string, any>
}

export const getExecutions = async (limit: number = 50): Promise<Execution[]> => {
  const resp = await apiFetch<{ executions: Execution[] }>(`/api/executions?limit=${limit}`)
  return resp.executions
}

// ---- Run Agent Review ----

export const runDailyReview = async (): Promise<{ recommendations_created: number; steps: any[]; errors?: string[] }> => {
  const res = await fetch(`${API_BASE}/api/run-review`, { method: 'POST' })
  if (!res.ok) throw new Error(`Run review failed: ${res.status}`)
  return res.json()
}

// ---- Reset Demo ----

export const resetDemo = async (full: boolean = false): Promise<{ status: string }> => {
  const res = await fetch(`${API_BASE}/api/reset-demo${full ? '?full=true' : ''}`, { method: 'POST' })
  if (!res.ok) throw new Error(`Reset failed: ${res.status}`)
  return res.json()
}
