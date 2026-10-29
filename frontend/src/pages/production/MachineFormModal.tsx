import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToastStore } from '@/stores/toastStore'
import type { MachineStage } from '@/types/database'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface MachineFormModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function MachineFormModal({ onClose, onSuccess }: MachineFormModalProps) {
  const addToast = useToastStore((s) => s.addToast)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    machine_code: '',
    name: '',
    stage: 'conversion' as MachineStage,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('machines').insert({
      machine_code: form.machine_code.trim(),
      name: form.name.trim(),
      stage: form.stage,
    })

    setLoading(false)

    if (error) addToast(error.message, 'error')
    else onSuccess()
  }

  return (
    <Modal open title="Add Machine" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Machine Code"
            value={form.machine_code}
            onChange={(e) => setForm({ ...form, machine_code: e.target.value })}
            required
            placeholder="e.g. PR-01"
          />
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="e.g. Printing Machine 1"
          />
        </div>

        <Select
          label="Machine Type"
          value={form.stage}
          onChange={(e) => setForm({ ...form, stage: e.target.value as MachineStage })}
        >
          <option value="conversion">Conversion — printing, cutting or sealing (uses a semi-finished roll)</option>
          <option value="extrusion">Extrusion — blown film line (uses raw materials)</option>
        </Select>
        <p className="text-xs text-slate-500">
          The type decides what a run on this machine consumes. A printing machine must be a Conversion machine.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Add Machine</Button>
        </div>
      </form>
    </Modal>
  )
}
