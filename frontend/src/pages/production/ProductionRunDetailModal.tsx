import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Machine, FinishedGood, ProductionRun, ProductRoll } from '@/types/database'
import { formatDate, formatKg, formatNumber, SHIFT_LABELS } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface ProductionRunDetailModalProps {
  /** One production run. A run that printed several brands has one row per brand. */
  rows: ProductionRun[]
  onClose: () => void
}

type Value = string | number | boolean | null | undefined

function Field({ label, value }: { label: string; value: Value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800">
        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-4">
      <p className="mb-3 text-sm font-semibold text-slate-800">{title}</p>
      {children}
    </div>
  )
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null)

const ROLL_STATUS_STYLE: Record<string, string> = {
  available: 'bg-emerald-50 text-emerald-700',
  reserved: 'bg-amber-50 text-amber-700',
  sold: 'bg-slate-100 text-slate-500',
}

export function ProductionRunDetailModal({ rows, onClose }: ProductionRunDetailModalProps) {
  const [rolls, setRolls] = useState<ProductRoll[]>([])
  const first = rows[0]
  const machine = first.machines as Machine | undefined
  const isConversion = machine?.stage === 'conversion'
  const processLabel = isConversion
    ? first.process_type === 'printing'
      ? 'Printing'
      : first.process_type === 'cutting'
      ? 'Cutting & sealing'
      : 'Conversion'
    : 'Extrusion'

  const ids = rows.map((r) => r.id).join(',')
  useEffect(() => {
    supabase
      .from('product_rolls')
      .select('*')
      .in('production_run_id', ids.split(','))
      .order('roll_no')
      .then(({ data }) => setRolls(data || []))
  }, [ids])

  const multi = rows.length > 1
  const totalOutput = rows.reduce((s, r) => s + Number(r.output_quantity), 0)
  const totalRollKg = rolls.reduce((s, r) => s + Number(r.weight_kg), 0)
  const totalWaste = rows.reduce((s, r) => s + Number(r.waste_quantity), 0)
  const materials = first.production_run_materials || []

  const hasTemps = [first.temp_z1, first.temp_z2, first.temp_z3, first.temp_z4, first.temp_z5, first.temp_z6].some(
    (t) => t !== null && t !== undefined
  )

  return (
    <Modal open title={multi ? `Production Run · ${rows.length} brands` : 'Production Run'} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Date" value={formatDate(first.run_date)} />
          <Field label="Shift" value={SHIFT_LABELS[first.shift]} />
          <Field label="Machine" value={machine ? `${machine.machine_code} · ${machine.name}` : null} />
          <Field label="Process" value={processLabel} />
          <Field label="Operator" value={first.operator_name} />
          <Field label="Supervisor" value={first.supervisor_name} />
        </div>

        <Section title={multi ? 'Brands printed in this run' : 'Output'}>
          <div className="space-y-3">
            {rows.map((r, idx) => {
              const product = r.finished_goods as FinishedGood | undefined
              const input = r.input_product as FinishedGood | undefined
              const rowRolls = rolls.filter((x) => x.production_run_id === r.id)
              const rowKg = rowRolls.reduce((s, x) => s + Number(x.weight_kg), 0)
              return (
                <div key={r.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {multi ? `${idx + 1}. ` : ''}
                      {product?.product_name || 'Product not set'}
                    </p>
                    <p className="text-sm font-medium text-slate-700">
                      {formatNumber(r.output_quantity)} {r.output_unit}
                      {rowRolls.length > 0 ? ` · ${formatKg(rowKg)}` : ''}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Field label="Thickness" value={r.film_thickness ? `${r.film_thickness}µ` : null} />
                    <Field label="Width" value={r.film_width ? `${r.film_width} mm` : null} />
                    <Field label="Colour" value={r.film_color} />
                    <Field label="Batch" value={r.batch_id} />
                    <Field label="Quality grade" value={r.quality_grade ? `Grade ${r.quality_grade}` : null} />
                    <Field
                      label="Input used"
                      value={
                        input && r.input_quantity_consumed > 0
                          ? `${formatNumber(r.input_quantity_consumed)} × ${input.product_name}`
                          : null
                      }
                    />
                    <Field label="Waste" value={Number(r.waste_quantity) > 0 ? `${formatNumber(r.waste_quantity)} kg` : null} />
                  </div>

                  {rowRolls.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs text-slate-500">
                        Individual rolls ({rowRolls.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {rowRolls.map((x) => (
                          <span
                            key={x.id}
                            title={x.status}
                            className={`rounded-lg px-2 py-1 text-xs ${ROLL_STATUS_STYLE[x.status] || 'bg-slate-100 text-slate-600'}`}
                          >
                            #{x.roll_no} · {x.weight_kg} kg
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        Green: available · Amber: reserved on an order · Grey: sold
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {multi && (
            <p className="mt-3 text-sm text-slate-600">
              Run total: <span className="font-semibold text-slate-900">{formatNumber(totalOutput)} {first.output_unit}</span>
              {rolls.length > 0 ? ` · ${formatKg(totalRollKg)}` : ''}
              {totalWaste > 0 ? ` · waste ${formatNumber(totalWaste)} kg` : ''}
            </p>
          )}
        </Section>

        {(first.start_time || first.end_time || first.total_runtime_hours || Number(first.downtime_hours) > 0) && (
          <Section title="Production time">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Start" value={hhmm(first.start_time)} />
              <Field label="End" value={hhmm(first.end_time)} />
              <Field label="Runtime" value={first.total_runtime_hours ? `${first.total_runtime_hours} hrs` : null} />
              <Field label="Downtime" value={Number(first.downtime_hours) > 0 ? `${first.downtime_hours} hrs` : null} />
            </div>
          </Section>
        )}

        {materials.length > 0 && (
          <Section title="Mixing formula">
            <div className="space-y-1.5 text-sm">
              {first.formula_code && <p className="text-xs text-slate-500">Formula code: {first.formula_code}</p>}
              {materials.map((m, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-slate-700">{m.raw_materials?.name || 'Material'}</span>
                  <span className="font-medium text-slate-900">{formatKg(Number(m.quantity_kg))}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {!isConversion && (first.roll_count || first.roll_length || first.avg_weight_per_roll || hasTemps || first.screw_speed_rpm || first.line_speed_mpm) && (
          <Section title="Extrusion output & machine settings">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Number of rolls" value={first.roll_count} />
              <Field label="Roll length" value={first.roll_length} />
              <Field label="Avg weight per roll" value={first.avg_weight_per_roll ? `${first.avg_weight_per_roll} kg` : null} />
              <Field label="Screw speed" value={first.screw_speed_rpm ? `${first.screw_speed_rpm} RPM` : null} />
              <Field label="Line speed" value={first.line_speed_mpm ? `${first.line_speed_mpm} m/min` : null} />
              <Field label="Zone 1" value={first.temp_z1 !== null ? `${first.temp_z1} °C` : null} />
              <Field label="Zone 2" value={first.temp_z2 !== null ? `${first.temp_z2} °C` : null} />
              <Field label="Zone 3" value={first.temp_z3 !== null ? `${first.temp_z3} °C` : null} />
              <Field label="Zone 4" value={first.temp_z4 !== null ? `${first.temp_z4} °C` : null} />
              <Field label="Zone 5" value={first.temp_z5 !== null ? `${first.temp_z5} °C` : null} />
              <Field label="Zone 6" value={first.temp_z6 !== null ? `${first.temp_z6} °C` : null} />
            </div>
          </Section>
        )}

        {first.process_type === 'cutting' && (
          <Section title="Cutting settings">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Cut length" value={first.cut_length_mm ? `${first.cut_length_mm} mm` : null} />
              <Field label="Bottom seal offset" value={first.bottom_seal_offset_mm ? `${first.bottom_seal_offset_mm} mm` : null} />
              <Field label="Cutting speed" value={first.cutting_speed_cpm ? `${first.cutting_speed_cpm} cuts/min` : null} />
            </div>
          </Section>
        )}

        {first.process_type === 'printing' && (
          <Section title="Printing settings">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Colours" value={first.print_colours_count} />
              <Field label="Print speed" value={first.print_speed} />
              <Field label="Tension" value={first.print_tension} />
              <Field label="Rollers cleaned" value={first.cleaned_rollers} />
              <Field label="Edges OK" value={first.roll_edges_ok} />
              <Field label="Neatness (1–5)" value={first.neatness_rating} />
            </div>
          </Section>
        )}

        {(first.samples_tested !== null || (first.qc_issues && first.qc_issues.length > 0)) && (
          <Section title="Quality control">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Samples tested" value={first.samples_tested} />
              <Field label="Passed" value={first.samples_passed} />
              <Field label="Failed" value={first.samples_failed} />
            </div>
            {first.qc_issues && first.qc_issues.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {first.qc_issues.map((q) => (
                  <Badge key={q} variant="warning">{q}</Badge>
                ))}
              </div>
            )}
            {first.qc_issue_other && <p className="mt-2 text-sm text-slate-700">{first.qc_issue_other}</p>}
          </Section>
        )}

        {first.notes && (
          <Section title="Remarks">
            <p className="whitespace-pre-wrap text-sm text-slate-700">{first.notes}</p>
          </Section>
        )}

        <div className="flex justify-end border-t pt-4">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}
