import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToastStore } from '@/stores/toastStore'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface MaterialFormModalProps {
  type: 'raw' | 'finished'
  onClose: () => void
  onSuccess: () => void
}

export function MaterialFormModal({ type, onClose, onSuccess }: MaterialFormModalProps) {
  const [loading, setLoading] = useState(false)
  const addToast = useToastStore((s) => s.addToast)

  const [rawForm, setRawForm] = useState({
    name: '',
    unit: 'kg',
    current_stock: '0',
    reorder_threshold: '0',
    supplier_name: '',
    supplier_contact: '',
  })

  const [finForm, setFinForm] = useState({
    product_name: '',
    spec_thickness: '',
    spec_width: '',
    color: '',
    unit: 'kg' as 'kg' | 'rolls',
    current_stock: '0',
    warehouse_location: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (type === 'raw') {
      const { error } = await supabase.from('raw_materials').insert({
        name: rawForm.name,
        unit: rawForm.unit,
        current_stock: parseFloat(rawForm.current_stock) || 0,
        reorder_threshold: parseFloat(rawForm.reorder_threshold) || 0,
        supplier_name: rawForm.supplier_name || null,
        supplier_contact: rawForm.supplier_contact || null,
      })
      if (error) addToast(error.message, 'error')
      else onSuccess()
    } else {
      const { error } = await supabase.from('finished_goods').insert({
        product_name: finForm.product_name,
        spec_thickness: finForm.spec_thickness ? parseFloat(finForm.spec_thickness) : null,
        spec_width: finForm.spec_width ? parseFloat(finForm.spec_width) : null,
        color: finForm.color || null,
        unit: finForm.unit,
        current_stock: parseFloat(finForm.current_stock) || 0,
        warehouse_location: finForm.warehouse_location || null,
      })
      if (error) addToast(error.message, 'error')
      else onSuccess()
    }

    setLoading(false)
  }

  return (
    <Modal
      open
      title={type === 'raw' ? 'Add Raw Material' : 'Add Finished Product'}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'raw' ? (
          <>
            <Input
              label="Material Name"
              value={rawForm.name}
              onChange={(e) => setRawForm({ ...rawForm, name: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Current Stock"
                type="number"
                step="0.01"
                value={rawForm.current_stock}
                onChange={(e) => setRawForm({ ...rawForm, current_stock: e.target.value })}
              />
              <Input
                label="Reorder Threshold"
                type="number"
                step="0.01"
                value={rawForm.reorder_threshold}
                onChange={(e) => setRawForm({ ...rawForm, reorder_threshold: e.target.value })}
              />
            </div>
            <Input
              label="Supplier Name"
              value={rawForm.supplier_name}
              onChange={(e) => setRawForm({ ...rawForm, supplier_name: e.target.value })}
            />
            <Input
              label="Supplier Contact"
              value={rawForm.supplier_contact}
              onChange={(e) => setRawForm({ ...rawForm, supplier_contact: e.target.value })}
            />
          </>
        ) : (
          <>
            <Input
              label="Product Name"
              value={finForm.product_name}
              onChange={(e) => setFinForm({ ...finForm, product_name: e.target.value })}
              required
            />
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Thickness (µ)"
                type="number"
                value={finForm.spec_thickness}
                onChange={(e) => setFinForm({ ...finForm, spec_thickness: e.target.value })}
              />
              <Input
                label="Width (mm)"
                type="number"
                value={finForm.spec_width}
                onChange={(e) => setFinForm({ ...finForm, spec_width: e.target.value })}
              />
              <Input
                label="Color"
                value={finForm.color}
                onChange={(e) => setFinForm({ ...finForm, color: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Unit"
                value={finForm.unit}
                onChange={(e) => setFinForm({ ...finForm, unit: e.target.value as 'kg' | 'rolls' })}
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="rolls">Rolls</option>
              </Select>
              <Input
                label="Warehouse Location"
                value={finForm.warehouse_location}
                onChange={(e) => setFinForm({ ...finForm, warehouse_location: e.target.value })}
              />
            </div>
          </>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
