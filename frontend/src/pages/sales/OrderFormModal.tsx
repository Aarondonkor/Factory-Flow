import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { Customer, FinishedGood } from '@/types/database'
import { toInputDate } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface OrderFormModalProps {
  customers: Customer[]
  finishedGoods: FinishedGood[]
  onClose: () => void
  onSuccess: () => void
}

export function OrderFormModal({ customers, finishedGoods, onClose, onSuccess }: OrderFormModalProps) {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    customer_id: customers[0]?.id || '',
    delivery_date: toInputDate(new Date(Date.now() + 7 * 86400000)),
    notes: '',
    finished_good_id: finishedGoods[0]?.id || '',
    quantity: '',
    unit_price: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseFloat(form.quantity)
    const price = parseFloat(form.unit_price)

    if (!qty || !price) {
      addToast('Enter valid quantity and price', 'error')
      return
    }

    setLoading(true)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: form.customer_id,
        delivery_date: form.delivery_date,
        notes: form.notes || null,
        created_by: user?.id,
      })
      .select()
      .single()

    if (orderError) {
      setLoading(false)
      addToast(orderError.message, 'error')
      return
    }

    const { error: itemError } = await supabase.from('order_items').insert({
      order_id: order.id,
      finished_good_id: form.finished_good_id,
      quantity: qty,
      unit_price: price,
    })

    setLoading(false)

    if (itemError) addToast(itemError.message, 'error')
    else onSuccess()
  }

  return (
    <Modal open title="Create Order" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Customer"
          value={form.customer_id}
          onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
          required
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>

        <Input
          label="Delivery Date"
          type="date"
          value={form.delivery_date}
          onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
        />

        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">Order Item</p>
          <Select
            label="Product"
            value={form.finished_good_id}
            onChange={(e) => setForm({ ...form, finished_good_id: e.target.value })}
            required
          >
            {finishedGoods.map((g) => (
              <option key={g.id} value={g.id}>
                {g.product_name} ({g.current_stock} {g.unit} in stock)
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input
              label="Quantity"
              type="number"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
            <Input
              label="Unit Price (GHS)"
              type="number"
              step="0.01"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              required
            />
          </div>
        </div>

        <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Create Order</Button>
        </div>
      </form>
    </Modal>
  )
}
