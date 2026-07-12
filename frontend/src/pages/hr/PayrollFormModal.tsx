import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { Employee } from '@/types/database'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface PayrollFormModalProps {
  employees: Employee[]
  onClose: () => void
  onSuccess: () => void
}

export function PayrollFormModal({ employees, onClose, onSuccess }: PayrollFormModalProps) {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const [loading, setLoading] = useState(false)
  const now = new Date()

  const [form, setForm] = useState({
    employee_id: employees[0]?.id || '',
    period_month: (now.getMonth() + 1).toString(),
    period_year: now.getFullYear().toString(),
    days_worked: '22',
    hours_worked: '176',
    gross_pay: '',
    deductions: '0',
    notes: '',
  })

  const selectedEmployee = employees.find((e) => e.id === form.employee_id)

  const autoCalculateGross = () => {
    if (!selectedEmployee) return
    let gross = 0
    const days = parseFloat(form.days_worked) || 0
    const hours = parseFloat(form.hours_worked) || 0

    if (selectedEmployee.rate_type === 'monthly') {
      gross = selectedEmployee.salary_rate || 0
    } else if (selectedEmployee.rate_type === 'hourly') {
      gross = (selectedEmployee.wage_rate || 0) * hours
    } else {
      gross = (selectedEmployee.wage_rate || 0) * days
    }

    setForm({ ...form, gross_pay: gross.toFixed(2) })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('payroll_records').insert({
      employee_id: form.employee_id,
      period_month: parseInt(form.period_month),
      period_year: parseInt(form.period_year),
      days_worked: parseFloat(form.days_worked) || 0,
      hours_worked: parseFloat(form.hours_worked) || 0,
      gross_pay: parseFloat(form.gross_pay) || 0,
      deductions: parseFloat(form.deductions) || 0,
      notes: form.notes || null,
      created_by: user?.id,
    })

    setLoading(false)
    if (error) addToast(error.message, 'error')
    else onSuccess()
  }

  return (
    <Modal open title="Generate Payroll Record" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Employee" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name} — {e.role_title}</option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Month" value={form.period_month} onChange={(e) => setForm({ ...form, period_month: e.target.value })}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('en', { month: 'long' })}</option>
            ))}
          </Select>
          <Input label="Year" type="number" value={form.period_year} onChange={(e) => setForm({ ...form, period_year: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Days Worked" type="number" step="0.5" value={form.days_worked} onChange={(e) => setForm({ ...form, days_worked: e.target.value })} />
          <Input label="Hours Worked" type="number" step="0.5" value={form.hours_worked} onChange={(e) => setForm({ ...form, hours_worked: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Gross Pay (GHS)" type="number" step="0.01" value={form.gross_pay} onChange={(e) => setForm({ ...form, gross_pay: e.target.value })} required />
          <Input label="Deductions (GHS)" type="number" step="0.01" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} />
        </div>

        <Button type="button" variant="secondary" onClick={autoCalculateGross}>
          Auto-calculate from employee rate
        </Button>

        <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Save Payroll</Button>
        </div>
      </form>
    </Modal>
  )
}
