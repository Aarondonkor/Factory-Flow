import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { Order } from '@/types/database'
import { formatCurrency } from '@/lib/format'
import { initiatePaystackPayment, generatePaymentRef } from '@/lib/paystack'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface PaymentModalProps {
  order: Order
  onClose: () => void
  onSuccess: () => void
}

export function PaymentModal({ order, onClose, onSuccess }: PaymentModalProps) {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    amount: order.balance_due.toString(),
    payment_method: 'cash' as 'paystack' | 'cash' | 'mobile_money' | 'bank_transfer',
    notes: '',
  })

  const recordPayment = async (paystackRef?: string) => {
    setLoading(true)
    const { error } = await supabase.from('payments').insert({
      order_id: order.id,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      paystack_reference: paystackRef || null,
      notes: form.notes || null,
      recorded_by: user?.id,
    })
    setLoading(false)

    if (error) addToast(error.message, 'error')
    else onSuccess()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)

    if (!amount || amount <= 0) {
      addToast('Enter a valid amount', 'error')
      return
    }

    if (form.payment_method === 'paystack') {
      const email = user?.email || 'customer@factoryflow.gh'
      const ref = generatePaymentRef(order.order_number)

      try {
        await initiatePaystackPayment(
          email,
          amount,
          ref,
          async (paystackRef) => {
            await recordPayment(paystackRef)
          },
          () => addToast('Payment cancelled', 'warning')
        )
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Paystack error', 'error')
      }
    } else {
      await recordPayment()
    }
  }

  return (
    <Modal open title={`Record Payment — ${order.order_number}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <span>Order Total</span>
            <span className="font-medium">{formatCurrency(order.total)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Balance Due</span>
            <span className="font-medium text-red-600">{formatCurrency(order.balance_due)}</span>
          </div>
        </div>

        <Input
          label="Amount (GHS)"
          type="number"
          step="0.01"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
        />

        <Select
          label="Payment Method"
          value={form.payment_method}
          onChange={(e) => setForm({ ...form, payment_method: e.target.value as typeof form.payment_method })}
        >
          <option value="cash">Cash</option>
          <option value="mobile_money">Mobile Money</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="paystack">Paystack (Online)</option>
        </Select>

        <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>
            {form.payment_method === 'paystack' ? 'Pay with Paystack' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
