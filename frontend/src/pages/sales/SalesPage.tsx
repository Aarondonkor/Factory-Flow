import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { Customer, Order, Payment, FinishedGood } from '@/types/database'
import { formatCurrency, formatDate, formatNumber, ORDER_STATUS_LABELS } from '@/lib/format'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, getOrderStatusBadge } from '@/components/ui/Badge'
import { ResponsiveTable, TableRow } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { PageTabs } from '@/components/ui/PageTabs'
import { CustomerFormModal } from './CustomerFormModal'
import { OrderFormModal } from './OrderFormModal'
import { PaymentModal } from './PaymentModal'

type Tab = 'orders' | 'customers' | 'payments'

export function SalesPage() {
  const [tab, setTab] = useState<Tab>('orders')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([])
  const [loading, setLoading] = useState(true)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null)

  const canWrite = useAuthStore((s) => s.hasRole('admin', 'sales_staff'))
  const addToast = useToastStore((s) => s.addToast)

  const fetchData = async () => {
    setLoading(true)
    const [custRes, ordRes, payRes, finRes] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase
        .from('orders')
        .select('*, customers(name, business_name), order_items(*, finished_goods(product_name))')
        .order('created_at', { ascending: false }),
      supabase
        .from('payments')
        .select('*, orders(order_number, customers(name))')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('finished_goods').select('*').order('product_name'),
    ])

    setCustomers(custRes.data || [])
    setOrders(ordRes.data || [])
    setPayments(payRes.data || [])
    setFinishedGoods(finRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const totalRevenue = orders.reduce((s, o) => s + o.amount_paid, 0)
  const outstanding = orders.reduce((s, o) => s + o.balance_due, 0)

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)

    if (error) {
      addToast(error.message, 'error')
    } else {
      addToast(`Order ${status === 'confirmed' ? 'confirmed — stock deducted' : 'updated'}`)
      fetchData()
    }
  }

  const tabs = [
    { id: 'orders' as const, label: 'Orders' },
    { id: 'customers' as const, label: 'Customers' },
    { id: 'payments' as const, label: 'Payments' },
  ]

  if (loading) return <LoadingSpinner className="py-20" />

  return (
    <div className="page-shell space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} />
        <StatCard label="Outstanding Balance" value={formatCurrency(outstanding)} alert={outstanding > 0} />
        <StatCard label="Total Orders" value={orders.length} />
      </div>

      <PageTabs
        tabs={tabs}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        action={
          canWrite && tab === 'customers' ? (
            <Button variant="secondary" onClick={() => setShowCustomerForm(true)}>
              + Add Customer
            </Button>
          ) : canWrite && tab === 'orders' ? (
            <Button variant="secondary" onClick={() => setShowOrderForm(true)}>
              + Create Order
            </Button>
          ) : undefined
        }
      />

      {tab === 'orders' && (
        <Card title="Orders">
          <ResponsiveTable
            headers={['Order #', 'Customer', 'Total', 'Paid', 'Balance', 'Status', 'Actions']}
            isEmpty={orders.length === 0}
          >
            {orders.map((o) => (
              <TableRow
                key={o.id}
                cells={[
                  o.order_number,
                  (o.customers as Customer)?.name || '—',
                  formatCurrency(o.total),
                  formatCurrency(o.amount_paid),
                  formatCurrency(o.balance_due),
                  <Badge variant={getOrderStatusBadge(o.status)}>
                    {ORDER_STATUS_LABELS[o.status]}
                  </Badge>,
                  canWrite ? (
                    <div className="flex gap-2 flex-wrap">
                      {o.status === 'pending' && (
                        <Button variant="secondary" onClick={() => updateOrderStatus(o.id, 'confirmed')}>
                          Confirm
                        </Button>
                      )}
                      {o.balance_due > 0 && (
                        <Button variant="secondary" onClick={() => setPaymentOrder(o)}>
                          Pay
                        </Button>
                      )}
                    </div>
                  ) : null,
                ]}
                mobileCard={
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{o.order_number}</span>
                      <Badge variant={getOrderStatusBadge(o.status)}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </Badge>
                    </div>
                    <p>{(o.customers as Customer)?.name}</p>
                    <div className="flex justify-between text-xs">
                      <span>Total: {formatCurrency(o.total)}</span>
                      <span>Due: {formatCurrency(o.balance_due)}</span>
                    </div>
                  </div>
                }
              />
            ))}
          </ResponsiveTable>
        </Card>
      )}

      {tab === 'customers' && (
        <Card title="Customers">
          <ResponsiveTable
            headers={['Name', 'Business', 'Phone', 'Email', 'Credit Terms']}
            isEmpty={customers.length === 0}
          >
            {customers.map((c) => (
              <TableRow
                key={c.id}
                cells={[
                  c.name,
                  c.business_name || '—',
                  c.contact_phone || '—',
                  c.contact_email || '—',
                  c.credit_terms_days ? `${c.credit_terms_days} days` : 'Cash',
                ]}
                mobileCard={
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{c.name}</p>
                    {c.business_name && <p className="text-xs text-slate-500">{c.business_name}</p>}
                    <p className="text-xs">{c.contact_phone}</p>
                  </div>
                }
              />
            ))}
          </ResponsiveTable>
        </Card>
      )}

      {tab === 'payments' && (
        <Card title="Payment History">
          <ResponsiveTable
            headers={['Date', 'Order', 'Customer', 'Amount', 'Method']}
            isEmpty={payments.length === 0}
          >
            {payments.map((p) => (
              <TableRow
                key={p.id}
                cells={[
                  formatDate(p.created_at),
                  (p.orders as Order)?.order_number || '—',
                  '—',
                  formatCurrency(p.amount),
                  p.payment_method.replace('_', ' '),
                ]}
                mobileCard={
                  <div className="flex justify-between text-sm">
                    <span>{formatDate(p.created_at)}</span>
                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                  </div>
                }
              />
            ))}
          </ResponsiveTable>
        </Card>
      )}

      {showCustomerForm && (
        <CustomerFormModal
          onClose={() => setShowCustomerForm(false)}
          onSuccess={() => {
            setShowCustomerForm(false)
            fetchData()
            addToast('Customer added')
          }}
        />
      )}

      {showOrderForm && (
        <OrderFormModal
          customers={customers}
          finishedGoods={finishedGoods}
          onClose={() => setShowOrderForm(false)}
          onSuccess={() => {
            setShowOrderForm(false)
            fetchData()
            addToast('Order created')
          }}
        />
      )}

      {paymentOrder && (
        <PaymentModal
          order={paymentOrder}
          onClose={() => setPaymentOrder(null)}
          onSuccess={() => {
            setPaymentOrder(null)
            fetchData()
            addToast('Payment recorded')
          }}
        />
      )}
    </div>
  )
}
