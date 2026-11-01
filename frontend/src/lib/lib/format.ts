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
  customer: 'Customer',
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

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  pending: 'Not Dispatched',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
}

export const SHIFT_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
}

/** Short spec suffix for an order line, e.g. " (35µ)". Empty when no micron was recorded. */
export function formatItemSpec(item: { specified_micron?: number | null }): string {
  return item.specified_micron ? ` (${item.specified_micron}µ)` : ''
}

/** Weight formatting for kg figures: up to 2 decimals, thousands separated. */
export function formatKg(kg: number): string {
  return `${kg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`
}

export const EXPENSE_CATEGORIES = [
  'Raw materials (resin, additives)',
  'Packaging & printing inks',
  'Salaries & wages',
  'Electricity',
  'Fuel & transport',
  'Machine maintenance & spares',
  'Rent',
  'Taxes, levies & permits',
  'Bank & Paystack fees',
  'Marketing',
  'Office & admin',
  'Other',
]

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  paystack: 'Paystack',
  cash: 'Cash',
  mobile_money: 'Mobile money',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cheque: 'Cheque',
}
