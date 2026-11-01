import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { Employee } from '@/types/database'
import { toInputDate } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface AttendanceFormModalProps {
  employees: Employee[]
  onClose: () => void
  onSuccess: () => void
}

export function AttendanceFormModal({ employees, onClose, onSuccess }: AttendanceFormModalProps) {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    employee_id: employees[0]?.id || '',
    attendance_date: toInputDate(),
    clock_in: '08:00',
    clock_out: '17:00',
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('attendance').upsert({
      employee_id: form.employee_id,
      attendance_date: form.attendance_date,
      clock_in: form.clock_in,
      clock_out: form.clock_out || null,
      notes: form.notes || null,
      recorded_by: user?.id,
    }, { onConflict: 'employee_id,attendance_date' })

    setLoading(false)
    if (error) addToast(error.message, 'error')
    else onSuccess()
  }

  return (
    <Modal open title="Log Attendance" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Employee" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </Select>
        <Input label="Date" type="date" value={form.attendance_date} onChange={(e) => setForm({ ...form, attendance_date: e.target.value })} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Clock In" type="time" value={form.clock_in} onChange={(e) => setForm({ ...form, clock_in: e.target.value })} />
          <Input label="Clock Out" type="time" value={form.clock_out} onChange={(e) => setForm({ ...form, clock_out: e.target.value })} />
        </div>
        <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}
