import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { initiatePaystackPayment, generatePaymentRef } from '@/lib/paystack'
import type { Order, Payment } from '@/types/database'
import { formatCurrency, formatDate, formatDateTime, ORDER_STATUS_LABELS, DELIVERY_STATUS_LABELS } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Badge, getOrderStatusBadge, getDeliveryStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface OrderDetailModalProps {
  order: Order
  onClose: () => void
  /** Show the "Pay with Paystack" action (customer's own order only) */
  canPay?: boolean
  onPaid?: () => void
}

export function OrderDetailModal({ order, onClose, canPay = false, onPaid }: OrderDetailModalProps) {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [balance, setBalance] = useState(order.balance_due)

  const fetchPayments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
    setPayments(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id])

  const handlePay = async () => {
    if (!user?.email) {
      addToast('Missing account email — please contact support', 'error')
      return
    }

    const ref = generatePaymentRef(order.order_number)
    setPaying(true)

    try {
      await initiatePaystackPayment(
        user.email,
        balance,
        ref,
        async (paystackRef) => {
          const { error } = await supabase.from('payments').insert({
            order_id: order.id,
            amount: balance,
            payment_method: 'paystack',
            paystack_reference: paystackRef,
          })

          setPaying(false)

          if (error) {
            addToast(error.message, 'error')
          } else {
            addToast('Payment received — thank you!')
            setBalance(0)
            fetchPayments()
            onPaid?.()
          }
        },
        () => {
          setPaying(false)
        }
      )
    } catch (err) {
      setPaying(false)
      addToast(err instanceof Error ? err.message : 'Paystack error', 'error')
    }
  }

  return (
    <Modal open title={`Order ${order.order_number}`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={getOrderStatusBadge(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
            <Badge variant={getDeliveryStatusBadge(order.delivery_status)}>
              {DELIVERY_STATUS_LABELS[order.delivery_status]}
            </Badge>
          </div>
          <span className="text-sm text-slate-500">Placed {formatDate(order.created_at)}</span>
        </div>

        {(order.delivery_date || order.notes) && (
          <div className="text-sm text-slate-600 space-y-1">
            {order.delivery_date && <p>Delivery date: {formatDate(order.delivery_date)}</p>}
            {order.notes && <p>Notes: {order.notes}</p>}
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Items</p>
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            {(order.order_items || []).map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-slate-800">
                    {item.finished_goods?.product_name || 'Item'}
                    {item.specified_micron ? ` — ${item.specified_micron}µ` : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <span className="font-semibold text-slate-800">{formatCurrency(item.line_total)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount Paid</span>
            <span className="text-emerald-600">{formatCurrency(order.amount_paid)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Balance Due</span>
            <span className={balance > 0 ? 'text-red-600' : 'text-emerald-600'}>{formatCurrency(balance)}</span>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Payment History</p>
          {loading ? (
            <LoadingSpinner className="py-4" />
          ) : payments.length === 0 ? (
            <p className="text-sm text-slate-400">No payments recorded yet</p>
          ) : (
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-800 capitalize">{p.payment_method.replace('_', ' ')}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(p.created_at)}</p>
                  </div>
                  <span className="font-semibold text-emerald-600">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {canPay && balance > 0 && (
            <Button onClick={handlePay} loading={paying}>
              Pay {formatCurrency(balance)} with Paystack
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
