import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { Machine, RawMaterial, FinishedGood } from '@/types/database'
import { toInputDate } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface ProductionRunFormProps {
  machines: Machine[]
  rawMaterials: RawMaterial[]
  finishedGoods: FinishedGood[]
  onClose: () => void
  onSuccess: () => void
}

export function ProductionRunForm({
  machines,
  rawMaterials,
  finishedGoods,
  onClose,
  onSuccess,
}: ProductionRunFormProps) {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    run_date: toInputDate(),
    shift: 'morning' as 'morning' | 'afternoon' | 'night',
    machine_id: machines[0]?.id || '',
    operator_name: '',
    finished_good_id: finishedGoods[0]?.id || '',
    film_thickness: '',
    film_width: '',
    film_color: '',
    output_quantity: '',
    output_unit: 'kg' as 'kg' | 'rolls',
    resin_material_id: rawMaterials[0]?.id || '',
    resin_consumed: '',
    additive_material_id: '',
    additive_consumed: '0',
    waste_quantity: '0',
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('production_runs').insert({
      run_date: form.run_date,
      shift: form.shift,
      machine_id: form.machine_id,
      operator_name: form.operator_name,
      finished_good_id: form.finished_good_id || null,
      film_thickness: form.film_thickness ? parseFloat(form.film_thickness) : null,
      film_width: form.film_width ? parseFloat(form.film_width) : null,
      film_color: form.film_color || null,
      output_quantity: parseFloat(form.output_quantity),
      output_unit: form.output_unit,
      resin_material_id: form.resin_material_id || null,
      resin_consumed: parseFloat(form.resin_consumed) || 0,
      additive_material_id: form.additive_material_id || null,
      additive_consumed: parseFloat(form.additive_consumed) || 0,
      waste_quantity: parseFloat(form.waste_quantity) || 0,
      notes: form.notes || null,
      created_by: user?.id,
    })

    setLoading(false)

    if (error) {
      addToast(error.message, 'error')
    } else {
      onSuccess()
    }
  }

  return (
    <Modal open title="Log Production Run" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Date"
            type="date"
            value={form.run_date}
            onChange={(e) => setForm({ ...form, run_date: e.target.value })}
            required
          />
          <Select
            label="Shift"
            value={form.shift}
            onChange={(e) => setForm({ ...form, shift: e.target.value as typeof form.shift })}
          >
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="night">Night</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Machine"
            value={form.machine_id}
            onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
            required
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>{m.machine_code} — {m.name}</option>
            ))}
          </Select>
          <Input
            label="Operator Name"
            value={form.operator_name}
            onChange={(e) => setForm({ ...form, operator_name: e.target.value })}
            required
          />
        </div>

        <Select
          label="Finished Product"
          value={form.finished_good_id}
          onChange={(e) => setForm({ ...form, finished_good_id: e.target.value })}
        >
          <option value="">— Select —</option>
          {finishedGoods.map((g) => (
            <option key={g.id} value={g.id}>{g.product_name}</option>
          ))}
        </Select>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Thickness (µ)"
            type="number"
            value={form.film_thickness}
            onChange={(e) => setForm({ ...form, film_thickness: e.target.value })}
          />
          <Input
            label="Width (mm)"
            type="number"
            value={form.film_width}
            onChange={(e) => setForm({ ...form, film_width: e.target.value })}
          />
          <Input
            label="Color"
            value={form.film_color}
            onChange={(e) => setForm({ ...form, film_color: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Output Quantity"
            type="number"
            step="0.01"
            value={form.output_quantity}
            onChange={(e) => setForm({ ...form, output_quantity: e.target.value })}
            required
          />
          <Select
            label="Output Unit"
            value={form.output_unit}
            onChange={(e) => setForm({ ...form, output_unit: e.target.value as 'kg' | 'rolls' })}
          >
            <option value="kg">Kilograms</option>
            <option value="rolls">Rolls</option>
          </Select>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium text-slate-700 mb-3">Material Consumption</p>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Resin"
              value={form.resin_material_id}
              onChange={(e) => setForm({ ...form, resin_material_id: e.target.value })}
            >
              {rawMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.current_stock} {m.unit} available)
                </option>
              ))}
            </Select>
            <Input
              label="Resin Consumed (kg)"
              type="number"
              step="0.01"
              value={form.resin_consumed}
              onChange={(e) => setForm({ ...form, resin_consumed: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Select
              label="Additive (optional)"
              value={form.additive_material_id}
              onChange={(e) => setForm({ ...form, additive_material_id: e.target.value })}
            >
              <option value="">— None —</option>
              {rawMaterials.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
            <Input
              label="Additive Consumed (kg)"
              type="number"
              step="0.01"
              value={form.additive_consumed}
              onChange={(e) => setForm({ ...form, additive_consumed: e.target.value })}
            />
          </div>
          <Input
            label="Waste / Scrap (kg)"
            type="number"
            step="0.01"
            className="mt-4"
            value={form.waste_quantity}
            onChange={(e) => setForm({ ...form, waste_quantity: e.target.value })}
          />
        </div>

        <Input
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Save Production Run</Button>
        </div>
      </form>
    </Modal>
  )
}
