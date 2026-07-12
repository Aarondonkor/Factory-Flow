import { useAuthStore } from '@/stores/authStore'
import { ROLE_LABELS } from '@/lib/format'
import { BRAND } from '@/lib/brand'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'

export function SettingsPage() {
  const profile = useAuthStore((s) => s.profile)

  return (
    <div className="page-shell space-y-6 max-w-2xl">
      <PageHeader title="Settings" subtitle="Account and system preferences" />

      <Card title="Account Settings">
        <dl className="space-y-4 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-3">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-semibold text-slate-900">{profile?.email}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-3">
            <dt className="text-slate-500">Full Name</dt>
            <dd className="font-semibold text-slate-900">{profile?.full_name || '—'}</dd>
          </div>
          <div className="flex justify-between items-center">
            <dt className="text-slate-500">Role</dt>
            <dd>
              <Badge variant="info">
                {profile?.role ? ROLE_LABELS[profile.role] : '—'}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Organisation">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-3">
            <dt className="text-slate-500">Company</dt>
            <dd className="font-semibold text-brand-800">{BRAND.name}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-3">
            <dt className="text-slate-500">Application</dt>
            <dd>{BRAND.appName}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-3">
            <dt className="text-slate-500">Currency</dt>
            <dd>GHS (Ghana Cedi)</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Date Format</dt>
            <dd>DD/MM/YYYY</dd>
          </div>
        </dl>
      </Card>

      <Card title="Admin Notes">
        <p className="text-sm leading-relaxed text-slate-600">
          To change user roles, update the <code className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-800">profiles</code> table
          in Supabase. Role changes take effect on next login.
        </p>
      </Card>
    </div>
  )
}
