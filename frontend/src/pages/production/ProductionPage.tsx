import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { ProductionRun, MachineDowntime, Machine, RawMaterial, FinishedGood } from '@/types/database'
import { formatDate, formatNumber, SHIFT_LABELS } from '@/lib/format'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ResponsiveTable, TableRow } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { PageTabs } from '@/components/ui/PageTabs'
import { ProductionRunForm } from './ProductionRunForm'
import { DowntimeForm } from './DowntimeForm'
import { MachineFormModal } from './MachineFormModal'
import { ProductionRunDetailModal } from './ProductionRunDetailModal'

type Tab = 'runs' | 'downtime' | 'machines' | 'summary'

export function ProductionPage() {
  const [tab, setTab] = useState<Tab>('runs')
  const [runs, setRuns] = useState<ProductionRun[]>([])
  const [downtimes, setDowntimes] = useState<MachineDowntime[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([])
  const [loading, setLoading] = useState(true)
  const [showRunForm, setShowRunForm] = useState(false)
  const [showDowntimeForm, setShowDowntimeForm] = useState(false)
  const [showMachineForm, setShowMachineForm] = useState(false)
  const [detailRuns, setDetailRuns] = useState<ProductionRun[] | null>(null)

  const canWrite = useAuthStore((s) => s.hasRole('admin', 'production_supervisor'))
  const isAdmin = useAuthStore((s) => s.hasRole('admin'))
  const addToast = useToastStore((s) => s.addToast)

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    const [runsRes, dtRes, machRes, rawRes, finRes] = await Promise.all([
      supabase
        .from('production_runs')
        .select(
          '*, machines(machine_code, name, stage), finished_goods:finished_goods!production_runs_finished_good_id_fkey(product_name, stage), input_product:finished_goods!production_runs_input_product_id_fkey(product_name), production_run_materials(quantity_kg, raw_materials(name))'
        )
        .order('run_date', { ascending: false })
        .limit(100),
      supabase
        .from('machine_downtime')
        .select('*, machines(machine_code, name)')
        .order('start_time', { ascending: false })
        .limit(50),
      supabase.from('machines').select('*').order('machine_code'),
      supabase.from('raw_materials').select('*').order('name'),
      supabase.from('finished_goods').select('*').order('product_name'),
    ])

    if (runsRes.error) { if (!silent) addToast(runsRes.error.message, 'error') }
    else setRuns(runsRes.data || [])

    if (dtRes.error) { if (!silent) addToast(dtRes.error.message, 'error') }
    else setDowntimes(dtRes.data || [])

    setMachines(machRes.data || [])
    setRawMaterials(rawRes.data || [])
    setFinishedGoods(finRes.data || [])
    if (!silent) setLoading(false)
  }

  const updateMachine = async (id: string, patch: { stage?: 'extrusion' | 'conversion'; is_active?: boolean }) => {
    const { error } = await supabase.from('machines').update(patch).eq('id', id)
    if (error) addToast(error.message, 'error')
    else {
      addToast('Machine updated')
      fetchData()
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useAutoRefresh(() => fetchData(true), 20000)

  const totalOutput = runs.reduce((sum, r) => sum + r.output_quantity, 0)
  const totalWaste = runs.reduce((sum, r) => sum + r.waste_quantity, 0)
  const totalInput = runs.reduce(
    (sum, r) => sum + (r.production_run_materials || []).reduce((s, m) => s + m.quantity_kg, 0),
    0
  )
  const yieldPercent = totalInput > 0 ? ((totalOutput / totalInput) * 100) : 0
  const wastePercent = totalInput > 0 ? ((totalWaste / totalInput) * 100) : 0
  const totalDowntimeHours = downtimes.reduce(
    (sum, d) => sum + (d.duration_minutes || 0) / 60,
    0
  )

  // Brands printed in one run are stored as separate rows that share a run_group_id;
  // show them together as a single run.
  const runGroups = useMemo(() => {
    const map = new Map<string, ProductionRun[]>()
    for (const r of runs) {
      const key = r.run_group_id ?? r.id
      const g = map.get(key)
      if (g) g.push(r)
      else map.set(key, [r])
    }
    return [...map.values()].map((g) => [...g].sort((a, b) => a.created_at.localeCompare(b.created_at)))
  }, [runs])

  const tabs = [
    { id: 'runs' as const, label: 'Production Runs' },
    { id: 'downtime' as const, label: 'Downtime Log' },
    { id: 'machines' as const, label: 'Machines' },
    { id: 'summary' as const, label: 'Summary' },
  ]

  if (loading) return <LoadingSpinner className="py-20" />

  return (
    <div className="page-shell space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Output" value={`${formatNumber(totalOutput)} kg/rolls`} />
        <StatCard label="Yield %" value={`${formatNumber(yieldPercent, 1)}%`} />
        <StatCard label="Waste %" value={`${formatNumber(wastePercent, 1)}%`} />
        <StatCard label="Downtime" value={`${formatNumber(totalDowntimeHours, 1)} hrs`} />
      </div>

      <PageTabs
        tabs={tabs}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        action={
          canWrite && tab === 'runs' ? (
            <Button variant="secondary" onClick={() => setShowRunForm(true)}>
              + Log Production Run
            </Button>
          ) : canWrite && tab === 'downtime' ? (
            <Button variant="secondary" onClick={() => setShowDowntimeForm(true)}>
              + Log Downtime
            </Button>
          ) : canWrite && tab === 'machines' ? (
            <Button variant="secondary" onClick={() => setShowMachineForm(true)}>
              + Add Machine
            </Button>
          ) : undefined
        }
      />

      {tab === 'runs' && (
        <Card title="Production Runs">
          <ResponsiveTable
            headers={['Date', 'Shift', 'Machine', 'Operator', 'Product', 'Output', 'Consumed', 'Waste']}
            isEmpty={runs.length === 0}
          >
            {runGroups.map((group) => {
              const r = group[0]
              const many = group.length > 1
              const isConversion = (r.machines as Machine)?.stage === 'conversion'
              const productNames = [...new Set(group.map((g) => g.finished_goods?.product_name).filter(Boolean))] as string[]
              const productLabel =
                productNames.length === 0
                  ? '—'
                  : productNames.length === 1
                  ? productNames[0]
                  : `${productNames[0]} +${productNames.length - 1} more`
              const outputTotal = group.reduce((sum, g) => sum + Number(g.output_quantity), 0)
              const wasteTotal = group.reduce((sum, g) => sum + Number(g.waste_quantity), 0)
              const materialsTotal = (r.production_run_materials || []).reduce((s, m) => s + m.quantity_kg, 0)
              const consumedLabel = isConversion
                ? many
                  ? `${formatNumber(group.reduce((sum, g) => sum + Number(g.input_quantity_consumed), 0))} semi-finished`
                  : `${formatNumber(r.input_quantity_consumed)} ${(r.input_product as FinishedGood)?.product_name || 'input'}`
                : `${formatNumber(materialsTotal)} kg materials`
              const open = () => setDetailRuns(group)
              return (
                <TableRow
                  key={r.run_group_id ?? r.id}
                  onClick={open}
                  cells={[
                    formatDate(r.run_date),
                    SHIFT_LABELS[r.shift],
                    (r.machines as Machine)?.machine_code || '—',
                    r.operator_name,
                    <span>
                      {productLabel}
                      {many && <Badge variant="info">{group.length} brands</Badge>}
                    </span>,
                    `${formatNumber(outputTotal)} ${r.output_unit}`,
                    consumedLabel,
                    `${formatNumber(wasteTotal)} kg`,
                  ]}
                  mobileCard={
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between font-medium">
                        <span>{formatDate(r.run_date)} · {SHIFT_LABELS[r.shift]}</span>
                        <span>{formatNumber(outputTotal)} {r.output_unit}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {(r.machines as Machine)?.name} · {r.operator_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {productLabel}
                        {many ? ` · ${group.length} brands` : ''}
                        {!many && isConversion ? ` ← ${(r.input_product as FinishedGood)?.product_name || 'input'}` : ''}
                      </p>
                      <p className="text-xs text-brand-700">Tap for details</p>
                    </div>
                  }
                />
              )
            })}
          </ResponsiveTable>
        </Card>
      )}

      {tab === 'machines' && (
        <Card title="Machines">
          <p className="mb-4 text-sm text-slate-500">
            Extrusion machines make rolls from raw materials. Conversion machines (printing, cutting and sealing)
            turn a semi-finished roll into a finished product — add your printing machine here as a Conversion machine.
          </p>
          <ResponsiveTable
            headers={['Code', 'Name', 'Type', 'Status', 'Actions']}
            isEmpty={machines.length === 0}
            emptyMessage="No machines yet"
          >
            {machines.map((m) => (
              <TableRow
                key={m.id}
                cells={[
                  m.machine_code,
                  m.name,
                  <Badge variant={m.stage === 'conversion' ? 'info' : 'default'}>
                    {m.stage === 'conversion' ? 'Conversion' : 'Extrusion'}
                  </Badge>,
                  <Badge variant={m.is_active ? 'success' : 'warning'}>{m.is_active ? 'Active' : 'Inactive'}</Badge>,
                  isAdmin ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => updateMachine(m.id, { stage: m.stage === 'conversion' ? 'extrusion' : 'conversion' })}
                      >
                        {m.stage === 'conversion' ? 'Make Extrusion' : 'Make Conversion'}
                      </Button>
                      <Button variant="secondary" onClick={() => updateMachine(m.id, { is_active: !m.is_active })}>
                        {m.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  ) : null,
                ]}
                mobileCard={
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{m.machine_code} · {m.name}</span>
                      <Badge variant={m.is_active ? 'success' : 'warning'}>{m.is_active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <Badge variant={m.stage === 'conversion' ? 'info' : 'default'}>
                      {m.stage === 'conversion' ? 'Conversion' : 'Extrusion'}
                    </Badge>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={() => updateMachine(m.id, { stage: m.stage === 'conversion' ? 'extrusion' : 'conversion' })}
                        >
                          {m.stage === 'conversion' ? 'Make Extrusion' : 'Make Conversion'}
                        </Button>
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={() => updateMachine(m.id, { is_active: !m.is_active })}
                        >
                          {m.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    )}
                  </div>
                }
              />
            ))}
          </ResponsiveTable>
        </Card>
      )}

      {tab === 'downtime' && (
        <Card title="Machine Downtime">
          <ResponsiveTable
            headers={['Machine', 'Reason', 'Start', 'End', 'Duration (min)']}
            isEmpty={downtimes.length === 0}
          >
            {downtimes.map((d) => (
              <TableRow
                key={d.id}
                cells={[
                  (d.machines as Machine)?.machine_code || '—',
                  d.reason.replace('_', ' '),
                  formatDate(d.start_time),
                  d.end_time ? formatDate(d.end_time) : 'Ongoing',
                  d.duration_minutes ? formatNumber(d.duration_minutes, 0) : '—',
                ]}
                mobileCard={
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{(d.machines as Machine)?.name}</span>
                      <span>{d.duration_minutes ? `${d.duration_minutes} min` : 'Ongoing'}</span>
                    </div>
                    <p className="text-xs text-slate-500 capitalize">{d.reason.replace('_', ' ')}</p>
                  </div>
                }
              />
            ))}
          </ResponsiveTable>
        </Card>
      )}

      {tab === 'summary' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card title="Production by Machine">
            {machines.map((m) => {
              const machineRuns = runs.filter((r) => r.machine_id === m.id)
              const output = machineRuns.reduce((s, r) => s + r.output_quantity, 0)
              return (
                <div key={m.id} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm">{m.name}</span>
                  <span className="text-sm font-medium">{formatNumber(output)} output</span>
                </div>
              )
            })}
          </Card>
          <Card title="Recent Activity">
            {runs.slice(0, 5).map((r) => (
              <div key={r.id} className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                <span>{formatDate(r.run_date)} · {r.operator_name}</span>
                <span className="font-medium">{formatNumber(r.output_quantity)} {r.output_unit}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {showRunForm && (
        <ProductionRunForm
          machines={machines.filter((m) => m.is_active)}
          rawMaterials={rawMaterials}
          finishedGoods={finishedGoods}
          onClose={() => setShowRunForm(false)}
          onSuccess={() => {
            setShowRunForm(false)
            fetchData()
            addToast('Production run logged — inventory updated automatically')
          }}
        />
      )}

      {detailRuns && <ProductionRunDetailModal rows={detailRuns} onClose={() => setDetailRuns(null)} />}

      {showMachineForm && (
        <MachineFormModal
          onClose={() => setShowMachineForm(false)}
          onSuccess={() => {
            setShowMachineForm(false)
            fetchData()
            addToast('Machine added')
          }}
        />
      )}

      {showDowntimeForm && (
        <DowntimeForm
          machines={machines.filter((m) => m.is_active)}
          onClose={() => setShowDowntimeForm(false)}
          onSuccess={() => {
            setShowDowntimeForm(false)
            fetchData()
            addToast('Downtime logged')
          }}
        />
      )}
    </div>
  )
}
