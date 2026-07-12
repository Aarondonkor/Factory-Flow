import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatNumber } from '@/lib/format'
import { Card, StatCard } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

interface DashboardData {
  totalProduction: number
  totalDowntimeHours: number
  yieldPercent: number
  wastePercent: number
  lowStockCount: number
  totalRevenue: number
  outstandingBalance: number
  activeEmployees: number
  todayAttendance: number
  productionByDay: { date: string; output: number }[]
  revenueByMonth: { month: string; revenue: number }[]
  lowStockItems: { name: string; stock: number; threshold: number }[]
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const profile = useAuthStore((s) => s.profile)
  const canAccessModule = useAuthStore((s) => s.canAccessModule)

  useEffect(() => {
    async function fetchDashboard() {
      const today = new Date().toISOString().split('T')[0]
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

      const [
        runsRes,
        downtimeRes,
        rawRes,
        ordersRes,
        employeesRes,
        attendanceRes,
      ] = await Promise.all([
        canAccessModule('production') || canAccessModule('dashboard')
          ? supabase.from('production_runs').select('*').gte('run_date', monthStart)
          : Promise.resolve({ data: [] }),
        canAccessModule('production')
          ? supabase.from('machine_downtime').select('duration_minutes')
          : Promise.resolve({ data: [] }),
        canAccessModule('inventory')
          ? supabase.from('raw_materials').select('name, current_stock, reorder_threshold')
          : Promise.resolve({ data: [] }),
        canAccessModule('sales')
          ? supabase.from('orders').select('amount_paid, balance_due, created_at')
          : Promise.resolve({ data: [] }),
        canAccessModule('hr')
          ? supabase.from('employees').select('id, is_active')
          : Promise.resolve({ data: [] }),
        canAccessModule('hr')
          ? supabase.from('attendance').select('id').eq('attendance_date', today)
          : Promise.resolve({ data: [] }),
      ])

      const runs = runsRes.data || []
      const totalProduction = runs.reduce((s, r) => s + (r.output_quantity || 0), 0)
      const totalInput = runs.reduce((s, r) => s + (r.resin_consumed || 0) + (r.additive_consumed || 0), 0)
      const totalWaste = runs.reduce((s, r) => s + (r.waste_quantity || 0), 0)
      const totalDowntimeHours = (downtimeRes.data || []).reduce(
        (s, d) => s + ((d.duration_minutes || 0) / 60),
        0
      )

      const rawMaterials = rawRes.data || []
      const lowStockItems = rawMaterials
        .filter((m) => m.reorder_threshold > 0 && m.current_stock <= m.reorder_threshold)
        .map((m) => ({ name: m.name, stock: m.current_stock, threshold: m.reorder_threshold }))

      const orders = ordersRes.data || []
      const totalRevenue = orders.reduce((s, o) => s + (o.amount_paid || 0), 0)
      const outstandingBalance = orders.reduce((s, o) => s + (o.balance_due || 0), 0)

      const dayMap = new Map<string, number>()
      runs.forEach((r) => {
        const d = r.run_date
        dayMap.set(d, (dayMap.get(d) || 0) + r.output_quantity)
      })
      const productionByDay = Array.from(dayMap.entries())
        .map(([date, output]) => ({ date: date.slice(5), output }))
        .slice(-14)

      const monthMap = new Map<string, number>()
      orders.forEach((o) => {
        const m = o.created_at.slice(0, 7)
        monthMap.set(m, (monthMap.get(m) || 0) + o.amount_paid)
      })
      const revenueByMonth = Array.from(monthMap.entries())
        .map(([month, revenue]) => ({ month: month.slice(5), revenue }))
        .slice(-6)

      setData({
        totalProduction,
        totalDowntimeHours,
        yieldPercent: totalInput > 0 ? (totalProduction / totalInput) * 100 : 0,
        wastePercent: totalInput > 0 ? (totalWaste / totalInput) * 100 : 0,
        lowStockCount: lowStockItems.length,
        totalRevenue,
        outstandingBalance,
        activeEmployees: (employeesRes.data || []).filter((e) => e.is_active).length,
        todayAttendance: (attendanceRes.data || []).length,
        productionByDay,
        revenueByMonth,
        lowStockItems,
      })
      setLoading(false)
    }

    fetchDashboard()
  }, [canAccessModule])

  if (loading) return <LoadingSpinner className="py-20" />
  if (!data) return null

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        userName={profile?.full_name}
        subtitle="Your factory command centre — production, inventory, sales & HR at a glance."
      />

      {data.lowStockCount > 0 && (
        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="warning">{data.lowStockCount} Low Stock Alerts</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.lowStockItems.map((item) => (
              <span key={item.name} className="rounded-lg border border-amber-100 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 shadow-sm">
                {item.name}: {formatNumber(item.stock)} / {formatNumber(item.threshold)} threshold
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(canAccessModule('production') || profile?.role === 'admin') && (
          <>
            <StatCard label="Production Output" value={`${formatNumber(data.totalProduction)} kg`} subtext="This month" />
            <StatCard label="Yield" value={`${formatNumber(data.yieldPercent, 1)}%`} />
            <StatCard label="Waste" value={`${formatNumber(data.wastePercent, 1)}%`} />
            <StatCard label="Downtime" value={`${formatNumber(data.totalDowntimeHours, 1)} hrs`} />
          </>
        )}
        {(canAccessModule('sales') || profile?.role === 'admin') && (
          <>
            <StatCard label="Revenue" value={formatCurrency(data.totalRevenue)} subtext="This month" />
            <StatCard
              label="Outstanding"
              value={formatCurrency(data.outstandingBalance)}
              alert={data.outstandingBalance > 0}
            />
          </>
        )}
        {(canAccessModule('inventory') || profile?.role === 'admin') && (
          <StatCard label="Low Stock Items" value={data.lowStockCount} alert={data.lowStockCount > 0} />
        )}
        {(canAccessModule('hr') || profile?.role === 'admin') && (
          <>
            <StatCard label="Active Staff" value={data.activeEmployees} />
            <StatCard label="Today's Attendance" value={data.todayAttendance} />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {data.productionByDay.length > 0 && (
          <Card title="Production Output (Last 14 Days)">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.productionByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="output" fill="#156853" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {data.revenueByMonth.length > 0 && (
          <Card title="Revenue Trend">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#D4A853" strokeWidth={2.5} dot={{ fill: '#156853' }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  )
}
