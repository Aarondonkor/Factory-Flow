import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { RawMaterial, FinishedGood, StockMovement, Customer } from '@/types/database'
import { formatDate, formatNumber, formatCurrency } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, getStockBadge } from '@/components/ui/Badge'
import { ResponsiveTable, TableRow } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { PageTabs } from '@/components/ui/PageTabs'
import { StockAdjustModal } from './StockAdjustModal'
import { MaterialFormModal } from './MaterialFormModal'

type Tab = 'raw' | 'finished' | 'movements'

export function InventoryPage() {
  const [tab, setTab] = useState<Tab>('raw')
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [adjustModal, setAdjustModal] = useState<{ type: 'raw' | 'finished'; id: string; name: string } | null>(null)
  const [formModal, setFormModal] = useState<'raw' | 'finished' | null>(null)

  const isAdmin = useAuthStore((s) => s.hasRole('admin'))
  const addToast = useToastStore((s) => s.addToast)

  const fetchData = async () => {
    setLoading(true)
    const [rawRes, finRes, movRes, custRes] = await Promise.all([
      supabase.from('raw_materials').select('*').order('name'),
      supabase.from('finished_goods').select('*').order('product_name'),
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('customers').select('*').order('name'),
    ])

    if (rawRes.error) addToast(rawRes.error.message, 'error')
    else setRawMaterials(rawRes.data || [])

    if (finRes.error) addToast(finRes.error.message, 'error')
    else setFinishedGoods(finRes.data || [])

    if (movRes.error) addToast(movRes.error.message, 'error')
    else setMovements(movRes.data || [])

    if (!custRes.error) setCustomers(custRes.data || [])

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const lowStockCount = rawMaterials.filter(
    (m) => m.reorder_threshold > 0 && m.current_stock <= m.reorder_threshold
  ).length

  const tabs = [
    { id: 'raw' as const, label: 'Raw Materials' },
    { id: 'finished' as const, label: 'Finished Goods' },
    { id: 'movements' as const, label: 'Stock History' },
  ]

  if (loading) return <LoadingSpinner className="py-20" />

  return (
    <div className="page-shell space-y-6">
      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200/80 bg-gradient-to-r from-red-50 to-white px-5 py-4 shadow-sm">
          <Badge variant="danger">{lowStockCount} Low Stock</Badge>
          <span className="text-sm font-medium text-red-800">
            {lowStockCount} raw material(s) below reorder threshold
          </span>
        </div>
      )}

      <PageTabs
        tabs={tabs}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        action={
          isAdmin && tab !== 'movements' ? (
            <Button
              variant="secondary"
              onClick={() => setFormModal(tab === 'raw' ? 'raw' : 'finished')}
            >
              + Add {tab === 'raw' ? 'Material' : 'Product'}
            </Button>
          ) : undefined
        }
      />

      {tab === 'raw' && (
        <Card title="Raw Materials">
          <ResponsiveTable
            headers={['Name', 'Stock', 'Threshold', 'Supplier', 'Last Restock', 'Actions']}
            isEmpty={rawMaterials.length === 0}
          >
            {rawMaterials.map((m) => (
              <TableRow
                key={m.id}
                cells={[
                  m.name,
                  <Badge variant={getStockBadge(m.current_stock, m.reorder_threshold)}>
                    {formatNumber(m.current_stock)} {m.unit}
                  </Badge>,
                  `${formatNumber(m.reorder_threshold)} ${m.unit}`,
                  m.supplier_name || '—',
                  formatDate(m.last_restock_date),
                  isAdmin ? (
                    <Button
                      variant="secondary"
                      onClick={() => setAdjustModal({ type: 'raw', id: m.id, name: m.name })}
                    >
                      Adjust
                    </Button>
                  ) : null,
                ]}
                mobileCard={
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{m.name}</span>
                      <Badge variant={getStockBadge(m.current_stock, m.reorder_threshold)}>
                        {formatNumber(m.current_stock)} {m.unit}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">Supplier: {m.supplier_name || '—'}</p>
                    {isAdmin && (
                      <Button
                        variant="secondary"
                        className="w-full mt-2"
                        onClick={() => setAdjustModal({ type: 'raw', id: m.id, name: m.name })}
                      >
                        Adjust Stock
                      </Button>
                    )}
                  </div>
                }
              />
            ))}
          </ResponsiveTable>
        </Card>
      )}

      {tab === 'finished' && (
        <Card title="Finished Goods">
          <ResponsiveTable
            headers={['Product', 'Stage', 'Spec', 'Stock', 'List Price', 'Exclusive To', 'Actions']}
            isEmpty={finishedGoods.length === 0}
          >
            {finishedGoods.map((g) => {
              const owner = g.customer_id ? customers.find((c) => c.id === g.customer_id) : null
              return (
                <TableRow
                  key={g.id}
                  cells={[
                    g.product_name,
                    <Badge variant={g.stage === 'semi_finished' ? 'warning' : 'success'}>
                      {g.stage === 'semi_finished' ? 'Semi-Finished' : 'Finished'}
                    </Badge>,
                    `${g.spec_thickness || '—'}µ × ${g.spec_width || '—'}mm ${g.color || ''}`,
                    `${formatNumber(g.current_stock)} ${g.unit === 'bundle' && g.bundle_size ? `bundle (${g.bundle_size}pc)` : g.unit}`,
                    g.unit_price != null ? formatCurrency(g.unit_price) : '—',
                    owner ? (
                      <Badge variant="info">{owner.business_name || owner.name}</Badge>
                    ) : (
                      <span className="text-slate-400 text-xs">All customers</span>
                    ),
                    isAdmin ? (
                      <Button
                        variant="secondary"
                        onClick={() => setAdjustModal({ type: 'finished', id: g.id, name: g.product_name })}
                      >
                        Adjust
                      </Button>
                    ) : null,
                  ]}
                  mobileCard={
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{g.product_name}</span>
                        <span>{formatNumber(g.current_stock)} {g.unit}</span>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={g.stage === 'semi_finished' ? 'warning' : 'success'}>
                          {g.stage === 'semi_finished' ? 'Semi-Finished' : 'Finished'}
                        </Badge>
                        {owner && <Badge variant="info">{owner.business_name || owner.name}</Badge>}
                      </div>
                      <p className="text-xs text-slate-500">{g.warehouse_location}</p>
                      {g.unit_price != null && (
                        <p className="text-xs font-semibold text-slate-700">{formatCurrency(g.unit_price)} / {g.unit}</p>
                      )}
                    </div>
                  }
                />
              )
            })}
          </ResponsiveTable>
        </Card>
      )}

      {tab === 'movements' && (
        <Card title="Stock Movement History">
          <ResponsiveTable
            headers={['Date', 'Type', 'Material', 'In/Out', 'Qty', 'Source', 'Reason']}
            isEmpty={movements.length === 0}
          >
            {movements.map((m) => {
              const materialName =
                m.material_type === 'raw'
                  ? rawMaterials.find((r) => r.id === m.material_id)?.name
                  : finishedGoods.find((f) => f.id === m.material_id)?.product_name

              return (
                <TableRow
                  key={m.id}
                  cells={[
                    formatDate(m.created_at),
                    m.material_type === 'raw' ? 'Raw' : 'Finished',
                    materialName || m.material_id.slice(0, 8),
                    <Badge variant={m.movement_type === 'in' ? 'success' : 'warning'}>
                      {m.movement_type.toUpperCase()}
                    </Badge>,
                    formatNumber(m.quantity),
                    m.source.replace('_', ' '),
                    m.reason || '—',
                  ]}
                  mobileCard={
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{materialName}</span>
                        <Badge variant={m.movement_type === 'in' ? 'success' : 'warning'}>
                          {m.movement_type} {formatNumber(m.quantity)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">{formatDate(m.created_at)} · {m.source}</p>
                    </div>
                  }
                />
              )
            })}
          </ResponsiveTable>
        </Card>
      )}

      {adjustModal && (
        <StockAdjustModal
          materialType={adjustModal.type}
          materialId={adjustModal.id}
          materialName={adjustModal.name}
          onClose={() => setAdjustModal(null)}
          onSuccess={() => {
            setAdjustModal(null)
            fetchData()
            addToast('Stock adjusted successfully')
          }}
        />
      )}

      {formModal && (
        <MaterialFormModal
          type={formModal}
          customers={customers}
          onClose={() => setFormModal(null)}
          onSuccess={() => {
            setFormModal(null)
            fetchData()
            addToast('Record created successfully')
          }}
        />
      )}
    </div>
  )
}
