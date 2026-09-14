import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { Customer, FinishedGood, Order } from '@/types/database'
import { formatCurrency, formatDate, toInputDate, ORDER_STATUS_LABELS } from '@/lib/format'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge, getOrderStatusBadge } from '@/components/ui/Badge'
import { ResponsiveTable, TableRow } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { PageTabs } from '@/components/ui/PageTabs'

type Tab = 'place-order' | 'my-orders'

interface CartLine {
  finished_good_id: string
  quantity: string
}

function unitLabel(g: FinishedGood) {
  if (g.unit === 'bundle') return g.bundle_size ? `bundle of ${g.bundle_size}` : 'bundle'
  return g.unit
}

export function CustomerPortalPage() {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)

  const [tab, setTab] = useState<Tab>('place-order')
  const [company, setCompany] = useState<Customer | null>(null)
  const [products, setProducts] = useState<FinishedGood[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [deliveryDate, setDeliveryDate] = useState(toInputDate(new Date(Date.now() + 7 * 86400000)))
  const [notes, setNotes] = useState('')
  const [cart, setCart] = useState<CartLine[]>([{ finished_good_id: '', quantity: '' }])

  const orderableProducts = products.filter((p) => p.unit_price != null)

  const fetchData = async () => {
    setLoading(true)
    const [companyRes, productsRes, ordersRes] = await Promise.all([
      supabase.from('customers').select('*').maybeSingle(),
      supabase.from('finished_goods').select('*').order('product_name'),
      supabase
        .from('orders')
        .select('*, order_items(*, finished_goods(product_name, unit))')
        .order('created_at', { ascending: false }),
    ])

    setCompany(companyRes.data || null)
    setProducts(productsRes.data || [])
    setOrders(ordersRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const isApproved = company?.approval_status === 'approved'

  const updateCartLine = (index: number, patch: Partial<CartLine>) => {
    setCart(cart.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const cartTotal = cart.reduce((sum, line) => {
    const product = products.find((p) => p.id === line.finished_good_id)
    const qty = parseFloat(line.quantity) || 0
    return sum + (product?.unit_price || 0) * qty
  }, 0)

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) return

    const validLines = cart.filter((l) => l.finished_good_id && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      addToast('Add at least one product with a quantity', 'error')
      return
    }

    setSubmitting(true)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: company.id,
        delivery_date: deliveryDate,
        notes: notes || null,
        status: 'pending',
        created_by: user?.id,
      })
      .select('id')
      .single()

    if (orderError) {
      setSubmitting(false)
      addToast(orderError.message, 'error')
      return
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      validLines.map((l) => ({
        order_id: order.id,
        finished_good_id: l.finished_good_id,
        quantity: parseFloat(l.quantity),
      }))
    )

    setSubmitting(false)

    if (itemsError) {
      addToast(itemsError.message, 'error')
      return
    }

    addToast('Order placed — awaiting confirmation')
    setCart([{ finished_good_id: '', quantity: '' }])
    setNotes('')
    setTab('my-orders')
    fetchData()
  }

  if (loading) return <LoadingSpinner className="py-20" />

  const pendingCount = orders.filter((o) => o.status === 'pending').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          {company?.business_name || company?.name || 'Your Orders'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Order directly from the factory and track your orders</p>
      </div>

      {!isApproved && (
        <Card className="!p-5 border-amber-300/80 bg-gradient-to-br from-amber-50 to-white">
          <p className="font-semibold text-amber-800">Account pending approval</p>
          <p className="mt-1 text-sm text-amber-700">
            {company?.approval_status === 'rejected'
              ? "Your account request wasn't approved. Please contact us for details."
              : "Our team is reviewing your company details. You'll be notified here as soon as you're approved, and can start ordering right away."}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Pending Orders" value={pendingCount} />
        <StatCard label="Total Orders" value={orders.length} />
      </div>

      <PageTabs
        tabs={[
          { id: 'place-order', label: 'Place Order' },
          { id: 'my-orders', label: 'My Orders' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {tab === 'place-order' && (
        <Card title="Place an Order">
          {!isApproved ? (
            <p className="text-sm text-slate-500">You'll be able to place orders once your account is approved.</p>
          ) : orderableProducts.length === 0 ? (
            <p className="text-sm text-slate-500">
              No products are available for online ordering yet. Please contact sales directly.
            </p>
          ) : (
            <form onSubmit={handleSubmitOrder} className="space-y-4">
              <div className="space-y-3">
                {cart.map((line, i) => {
                  const product = products.find((p) => p.id === line.finished_good_id)
                  return (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                      <Select
                        label={i === 0 ? 'Product' : undefined}
                        value={line.finished_good_id}
                        onChange={(e) => updateCartLine(i, { finished_good_id: e.target.value })}
                        required
                      >
                        <option value="">— Select a product —</option>
                        {orderableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.product_name} — {formatCurrency(p.unit_price || 0)} / {unitLabel(p)}
                            {p.customer_id ? ' (your branded product)' : ''}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label={i === 0 ? `Quantity${product ? ` (${unitLabel(product)})` : ''}` : undefined}
                        type="number"
                        step="0.01"
                        className="w-32"
                        value={line.quantity}
                        onChange={(e) => updateCartLine(i, { quantity: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setCart(cart.filter((_, idx) => idx !== i))}
                        disabled={cart.length === 1}
                      >
                        ✕
                      </Button>
                    </div>
                  )
                })}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCart([...cart, { finished_good_id: '', quantity: '' }])}
              >
                + Add Another Product
              </Button>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <Input
                  label="Delivery Date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
                <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <p className="text-sm text-slate-600">
                  Estimated total: <span className="font-bold text-slate-900">{formatCurrency(cartTotal)}</span>
                </p>
                <Button type="submit" loading={submitting}>Place Order</Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {tab === 'my-orders' && (
        <Card title="My Orders">
          <ResponsiveTable
            headers={['Order #', 'Date', 'Items', 'Total', 'Status']}
            isEmpty={orders.length === 0}
            emptyMessage="You haven't placed any orders yet"
          >
            {orders.map((o) => (
              <TableRow
                key={o.id}
                cells={[
                  o.order_number,
                  formatDate(o.created_at),
                  (o.order_items || [])
                    .map((it) => `${it.quantity} × ${it.finished_goods?.product_name || 'item'}`)
                    .join(', ') || '—',
                  formatCurrency(o.total),
                  <Badge variant={getOrderStatusBadge(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge>,
                ]}
                mobileCard={
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{o.order_number}</span>
                      <Badge variant={getOrderStatusBadge(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {(o.order_items || [])
                        .map((it) => `${it.quantity} × ${it.finished_goods?.product_name || 'item'}`)
                        .join(', ')}
                    </p>
                    <div className="flex justify-between text-xs">
                      <span>{formatDate(o.created_at)}</span>
                      <span className="font-semibold">{formatCurrency(o.total)}</span>
                    </div>
                  </div>
                }
              />
            ))}
          </ResponsiveTable>
        </Card>
      )}
    </div>
  )
}
