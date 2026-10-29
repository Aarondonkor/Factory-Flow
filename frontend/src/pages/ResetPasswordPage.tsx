import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ToastContainer } from '@/components/ui/Toast'

type LinkState = 'checking' | 'ready' | 'invalid'

/**
 * Landing page for the link in the "reset your password" email. Supabase turns
 * the link's token into a temporary session; once that exists the person can
 * choose a new password.
 */
export function ResetPasswordPage() {
  const [linkState, setLinkState] = useState<LinkState>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const updatePassword = useAuthStore((s) => s.updatePassword)
  const addToast = useToastStore((s) => s.addToast)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    // Fires when the token in the link is exchanged for a session.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setLinkState('ready')
      }
    })

    // The link may already have been processed before this page mounted.
    // getSession() waits for that processing to finish.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setLinkState((prev) => (prev === 'ready' ? prev : data.session ? 'ready' : 'invalid'))
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 6) {
      addToast('Password must be at least 6 characters', 'error')
      return
    }
    if (password !== confirm) {
      addToast("Passwords don't match", 'error')
      return
    }

    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)

    if (error) {
      addToast(error, 'error')
      return
    }

    addToast('Password updated')
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f5] p-6">
      <div className="w-full max-w-md card p-8 shadow-elevated">
        <div className="mb-6 flex justify-center">
          <Logo size="md" />
        </div>

        {linkState === 'checking' && (
          <p className="text-center text-sm text-slate-500">Checking your reset link…</p>
        )}

        {linkState === 'invalid' && (
          <div className="space-y-4 text-center">
            <h1 className="font-display text-xl font-bold text-slate-900">Link expired or invalid</h1>
            <p className="text-sm text-slate-500">
              This password reset link has expired or was already used. Request a new one from the sign-in page.
            </p>
            <Link to="/login" className="inline-block font-semibold text-brand-700 hover:underline">
              Back to sign in
            </Link>
          </div>
        )}

        {linkState === 'ready' && (
          <>
            <div className="mb-6 text-center">
              <h1 className="font-display text-xl font-bold text-slate-900">Choose a new password</h1>
              <p className="mt-1.5 text-sm text-slate-500">Use at least 6 characters.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="New password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <Input
                label="Confirm new password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <Button type="submit" loading={loading} className="w-full !py-3">
                Update password
              </Button>
            </form>
          </>
        )}
      </div>
      <ToastContainer />
    </div>
  )
}
