const CURRENCY = 'GHS'

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function toInputDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin / Owner',
  production_supervisor: 'Production Supervisor',
  sales_staff: 'Sales Staff',
  hr_officer: 'HR Officer',
  staff: 'Staff / Worker',
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_production: 'In Production',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export const SHIFT_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
}
