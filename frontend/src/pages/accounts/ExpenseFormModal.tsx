import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToastStore } from '@/stores/toastStore'
import type { Expense } from '@/types/database'
import { EXPENSE_CATEGORIES, PAYMENT_METHOD_LABELS, toInputDate } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface ExpenseFormModalProps {
  expense?: Expense | null
  onClose: () => void
  onSuccess: () => void
}

const EXPENSE_METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card', 'cheque'] as const

export function ExpenseFormModal({ expense, onClose, onSuccess }: ExpenseFormModalProps) {
  const addToast = useToastStore((s) => s.addToast)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    expense_date: expense?.expense_date ?? toInputDate(),
    category: expense?.category ?? EXPENSE_CATEGORIES[0],
    description: expense?.description ?? '',
    amount: expense ? String(expense.amount) : '',
    payment_method: expense?.payment_method ?? 'cash',
    vendor: expense?.vendor ?? '',
    reference: expense?.reference ?? '',
    notes: expense?.notes ?? '',
  })

  // Keep a category that was typed in earlier selectable when editing.
  const categories = EXPENSE_CATEGORIES.includes(form.category)
    ? EXPENSE_CATEGORIES
    : [form.category, ...EXPENSE_CATEGORIES]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!(amount > 0)) {
      addToast('Enter an amount greater than 0', 'error')
      return
    }

    setLoading(true)
    const payload = {
      expense_date: form.expense_date,
      category: form.category,
      description: form.description.trim(),
      amount,
      payment_method: form.payment_method,
      vendor: form.vendor.trim() || null,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
    }

    const { error } = expense
      ? await supabase.from('expenses').update(payload).eq('id', expense.id)
      : await supabase.from('expenses').insert(payload)

    setLoading(false)
    if (error) addToast(error.message, 'error')
    else onSuccess()
  }

  return (
    <Modal open title={expense ? 'Edit Expense' : 'Add Expense'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Date"
            type="date"
            value={form.expense_date}
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            required
          />
          <Input
            label="Amount (GHS)"
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Select
            label="Paid by"
            value={form.payment_method}
            onChange={(e) => setForm({ ...form, payment_method: e.target.value as Expense['payment_method'] })}
          >
            {EXPENSE_METHODS.map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
            ))}
          </Select>
        </div>

        <Input
          label="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
          placeholder="e.g. 500 kg LDPE resin"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Supplier / paid to (optional)"
            value={form.vendor}
            onChange={(e) => setForm({ ...form, vendor: e.target.value })}
          />
          <Input
            label="Receipt / invoice no. (optional)"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
          />
        </div>

        <Input
          label="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{expense ? 'Save changes' : 'Add Expense'}</Button>
        </div>
      </form>
    </Modal>
  )
}
