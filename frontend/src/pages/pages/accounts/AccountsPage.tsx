import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { useToastStore } from '@/stores/toastStore'
import type { Expense, LedgerEntry } from '@/types/database'
import { PAYMENT_METHOD_LABELS, formatCurrency, formatDate } from '@/lib/format'
import { downloadCsv } from '@/lib/csv'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ResponsiveTable, TableRow } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { PageTabs } from '@/components/ui/PageTabs'
import { ExpenseFormModal } from './ExpenseFormModal'

type Tab = 'overview' | 'ledger' | 'expenses'
type Preset = 'this_month' | 'last_month' | 'this_year' | 'custom'

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (year: number, month0: number, day: number) => `${year}-${pad(month0 + 1)}-${pad(day)}`
const lastDay = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate()

function presetRange(preset: Exclude<Preset, 'custom'>): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  if (preset === 'this_month') return { from: ymd(y, m, 1), to: ymd(y, m, lastDay(y, m)) }
  if (preset === 'last_month') {
    const d = new Date(y, m - 1, 1)
    return { from: ymd(d.getFullYear(), d.getMonth(), 1), to: ymd(d.getFullYear(), d.getMonth(), lastDay(d.getFullYear(), d.getMonth())) }
  }
  return { from: ymd(y, 0, 1), to: ymd(y, 11, 31) }
}

// The data service returns at most 1,000 rows per request, so read in pages.
// Otherwise a busy year would be silently cut off and the totals would be wrong.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllRows<T>(build: () => any): Promise<{ data: T[]; error: string | null }> {
  const pageSize = 1000
  let all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error) return { data: all, error: error.message }
    all = all.concat((data || []) as T[])
    if (!data || data.length < pageSize) break
  }
  return { data: all, error: null }
}

const methodLabel = (m: string | null) => (m ? PAYMENT_METHOD_LABELS[m] || m : '—')
const sum = (entries: LedgerEntry[]) => entries.reduce((s, e) => s + Number(e.amount), 0)

export function AccountsPage() {
  const addToast = useToastStore((s) => s.addToast)

  const [tab, setTab] = useState<Tab>('overview')
  const [preset, setPreset] = useState<Preset>('this_month')
  const [customFrom, setCustomFrom] = useState(presetRange('this_month').from)
  const [customTo, setCustomTo] = useState(presetRange('this_month').to)
  const [includePayroll, setIncludePayroll] = useState(true)

  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [owed, setOwed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)

  const range = preset === 'custom' ? { from: customFrom, to: customTo } : presetRange(preset)
  const rangeValid = Boolean(range.from && range.to && range.from <= range.to)

  const fetchData = async (silent = false) => {
    if (!rangeValid) return

    const [ledgerRes, expenseRes, owedRes] = await Promise.all([
      fetchAllRows<LedgerEntry>(() =>
        supabase
          .from('accounting_ledger')
          .select('*')
          .gte('entry_date', range.from)
          .lte('entry_date', range.to)
          .order('entry_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('entry_id')
      ),
      fetchAllRows<Expense>(() =>
        supabase
          .from('expenses')
          .select('*')
          .gte('expense_date', range.from)
          .lte('expense_date', range.to)
          .order('expense_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id')
      ),
      supabase.from('orders').select('balance_due').neq('status', 'cancelled').gt('balance_due', 0),
    ])

    if (ledgerRes.error && !silent) addToast(ledgerRes.error, 'error')
    else if (!ledgerRes.error) setEntries(ledgerRes.data)

    if (!expenseRes.error) setExpenses(expenseRes.data)
    if (!owedRes.error) setOwed((owedRes.data || []).reduce((s, o) => s + Number(o.balance_due), 0))

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to])

  useAutoRefresh(() => fetchData(true), 30000)

  const visible = useMemo(
    () => (includePayroll ? entries : entries.filter((e) => e.source !== 'payroll')),
    [entries, includePayroll]
  )

  const revenueEntries = visible.filter((e) => e.entry_type === 'revenue')
  const expenseEntries = visible.filter((e) => e.entry_type === 'expense')
  const revenue = sum(revenueEntries)
  const expenseTotal = sum(expenseEntries)
  const net = revenue - expenseTotal

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    expenseEntries.forEach((e) => map.set(e.category, (map.get(e.category) || 0) + Number(e.amount)))
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [expenseEntries])

  const byMethod = useMemo(() => {
    const map = new Map<string, number>()
    revenueEntries.forEach((e) => map.set(e.method || 'other', (map.get(e.method || 'other') || 0) + Number(e.amount)))
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [revenueEntries])

  const payrollCount = entries.filter((e) => e.source === 'payroll').length

  // ----- exports (CSV opens directly in Excel, Google Sheets and LibreOffice) -----

  const exportLedger = () => {
    const rows = [...visible].sort(
      (a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)
    )
    downloadCsv(`ledger_${range.from}_to_${range.to}.csv`, [
      ['Date', 'Type', 'Category', 'Description', 'Payment method', 'Reference', 'Revenue (GHS)', 'Expense (GHS)'],
      ...rows.map((e) => [
        e.entry_date,
        e.entry_type === 'revenue' ? 'Revenue' : 'Expense',
        e.category,
        e.description,
        e.method ? methodLabel(e.method) : '',
        e.reference,
        e.entry_type === 'revenue' ? Number(e.amount) : null,
        e.entry_type === 'expense' ? Number(e.amount) : null,
      ]),
      [],
      ['', '', '', 'Total revenue', '', '', Number(revenue.toFixed(2)), null],
      ['', '', '', 'Total expenses', '', '', null, Number(expenseTotal.toFixed(2))],
      ['', '', '', 'Net profit', '', '', Number(net.toFixed(2)), null],
    ])
  }

  const exportSummary = () => {
    downloadCsv(`summary_${range.from}_to_${range.to}.csv`, [
      ['Period', `${range.from} to ${range.to}`],
      ['Salaries from payroll included', includePayroll ? 'Yes' : 'No'],
      [],
      ['Revenue received (GHS)', Number(revenue.toFixed(2))],
      ['Expenses (GHS)', Number(expenseTotal.toFixed(2))],
      ['Net profit (GHS)', Number(net.toFixed(2))],
      [],
      ['Expenses by category', 'Amount (GHS)'],
      ...byCategory.map(([c, v]) => [c, Number(v.toFixed(2))]),
      [],
      ['Revenue by payment method', 'Amount (GHS)'],
      ...byMethod.map(([m, v]) => [methodLabel(m), Number(v.toFixed(2))]),
    ])
  }

  // ----- expenses -----

  const deleteExpense = async (e: Expense) => {
    if (!window.confirm(`Delete this expense?\n\n${e.description} — ${formatCurrency(e.amount)}`)) return
    const { error } = await supabase.from('expenses').delete().eq('id', e.id)
    if (error) addToast(error.message, 'error')
    else {
      addToast('Expense deleted')
      fetchData(true)
    }
  }

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  if (loading) return <LoadingSpinner className="py-20" />

  const amountCell = (e: LedgerEntry) => (
    <span className={`font-semibold ${e.entry_type === 'revenue' ? 'text-emerald-600' : 'text-rose-600'}`}>
      {e.entry_type === 'revenue' ? '+' : '−'}
      {formatCurrency(Number(e.amount))}
    </span>
  )

  return (
    <div className="page-shell space-y-6">
      {/* Period + options */}
      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <Select label="Period" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="this_year">This year</option>
            <option value="custom">Custom dates</option>
          </Select>
          {preset === 'custom' ? (
            <>
              <Input label="From" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <Input label="To" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </>
          ) : (
            <p className="text-sm text-slate-500 sm:col-span-2">
              {formatDate(range.from)} – {formatDate(range.to)}
            </p>
          )}
        </div>
        {!rangeValid && (
          <p className="mt-3 text-sm text-amber-700">Choose a valid date range (the start must not be after the end).</p>
        )}
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={includePayroll}
            onChange={(e) => setIncludePayroll(e.target.checked)}
          />
          <span>
            Count payroll from HR as a salary expense (gross pay, dated the last day of each pay period
            {payrollCount > 0 ? ` — ${payrollCount} record${payrollCount === 1 ? '' : 's'} in this period` : ''}).
            <span className="block text-xs text-slate-500">
              Turn this off if you also record salaries yourself as expenses, so they aren't counted twice.
            </span>
          </span>
        </label>
      </Card>

      <PageTabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'ledger', label: 'Ledger' },
          { id: 'expenses', label: 'Expenses' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        action={
          tab === 'expenses' ? (
            <Button variant="secondary" onClick={openAdd}>+ Add Expense</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={exportLedger}>Download ledger (CSV)</Button>
              {tab === 'overview' && <Button variant="secondary" onClick={exportSummary}>Summary (CSV)</Button>}
            </>
          )
        }
      />

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Revenue received" value={formatCurrency(revenue)} subtext="Every payment, logged automatically" />
            <StatCard label="Expenses" value={formatCurrency(expenseTotal)} />
            <StatCard label="Net profit" value={formatCurrency(net)} alert={net < 0} />
            <StatCard label="Owed by customers" value={formatCurrency(owed)} subtext="Unpaid order balances, all time" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Expenses by category">
              {byCategory.length === 0 ? (
                <p className="text-sm text-slate-500">No expenses in this period. Add them on the Expenses tab.</p>
              ) : (
                <div className="space-y-3">
                  {byCategory.map(([category, value]) => (
                    <div key={category}>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">{category}</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(value)}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-rose-400"
                          style={{ width: `${expenseTotal > 0 ? Math.max(2, (value / expenseTotal) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Revenue by payment method">
              {byMethod.length === 0 ? (
                <p className="text-sm text-slate-500">No payments received in this period.</p>
              ) : (
                <div className="space-y-3">
                  {byMethod.map(([method, value]) => (
                    <div key={method}>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">{methodLabel(method)}</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(value)}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-emerald-400"
                          style={{ width: `${revenue > 0 ? Math.max(2, (value / revenue) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 text-xs text-slate-500">
                Revenue is the money actually received. Paystack's own charges are deducted from your payout, so
                record them as an expense (Bank &amp; Paystack fees) to match your bank balance.
              </p>
            </Card>
          </div>
        </>
      )}

      {tab === 'ledger' && (
        <Card title="Ledger">
          <ResponsiveTable
            headers={['Date', 'Type', 'Category', 'Description', 'Method', 'Reference', 'Amount']}
            isEmpty={visible.length === 0}
            emptyMessage="No transactions in this period"
          >
            {visible.map((e) => (
              <TableRow
                key={e.entry_id}
                cells={[
                  formatDate(e.entry_date),
                  <Badge variant={e.entry_type === 'revenue' ? 'success' : 'warning'}>
                    {e.entry_type === 'revenue' ? 'Revenue' : 'Expense'}
                  </Badge>,
                  e.category,
                  <span>
                    {e.description}
                    {e.source === 'payroll' && <span className="ml-2 text-xs text-slate-400">auto</span>}
                  </span>,
                  methodLabel(e.method),
                  e.reference || '—',
                  amountCell(e),
                ]}
                mobileCard={
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{formatDate(e.entry_date)} · {e.category}</span>
                      {amountCell(e)}
                    </div>
                    <p className="text-slate-800">{e.description}</p>
                    <p className="text-xs text-slate-500">
                      {methodLabel(e.method)}
                      {e.reference ? ` · ${e.reference}` : ''}
                    </p>
                  </div>
                }
              />
            ))}
          </ResponsiveTable>
        </Card>
      )}

      {tab === 'expenses' && (
        <Card title="Expenses">
          <ResponsiveTable
            headers={['Date', 'Category', 'Description', 'Paid to', 'Paid by', 'Amount', 'Actions']}
            isEmpty={expenses.length === 0}
            emptyMessage="No expenses recorded in this period"
          >
            {expenses.map((e) => (
              <TableRow
                key={e.id}
                cells={[
                  formatDate(e.expense_date),
                  e.category,
                  e.description,
                  e.vendor || '—',
                  methodLabel(e.payment_method),
                  <span className="font-semibold text-rose-600">{formatCurrency(e.amount)}</span>,
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(e)
                        setFormOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => deleteExpense(e)}>Delete</Button>
                  </div>,
                ]}
                mobileCard={
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{formatDate(e.expense_date)} · {e.category}</span>
                      <span className="font-semibold text-rose-600">{formatCurrency(e.amount)}</span>
                    </div>
                    <p className="text-slate-800">{e.description}</p>
                    <p className="text-xs text-slate-500">
                      {methodLabel(e.payment_method)}
                      {e.vendor ? ` · ${e.vendor}` : ''}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => {
                          setEditing(e)
                          setFormOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="danger" className="flex-1" onClick={() => deleteExpense(e)}>Delete</Button>
                    </div>
                  </div>
                }
              />
            ))}
          </ResponsiveTable>
        </Card>
      )}

      {formOpen && (
        <ExpenseFormModal
          expense={editing}
          onClose={() => setFormOpen(false)}
          onSuccess={() => {
            setFormOpen(false)
            addToast(editing ? 'Expense updated' : 'Expense added')
            fetchData(true)
          }}
        />
      )}
    </div>
  )
}
