import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { BRAND } from '@/lib/brand'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ToastContainer } from '@/components/ui/Toast'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgot, setIsForgot] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const { user, signIn, signUp, resetPassword } = useAuthStore()
  const addToast = useToastStore((s) => s.addToast)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (isForgot) {
      const { error } = await resetPassword(email.trim())
      setLoading(false)
      if (error) addToast(error, 'error')
      else setResetSent(true)
      return
    }

    const result = isSignUp
      ? await signUp(email, password, fullName, jobTitle, contactPhone)
      : await signIn(email, password)

    setLoading(false)

    if (result.error) {
      addToast(result.error, 'error')
    } else if (isSignUp) {
      addToast('Account created! Check your email to confirm.', 'success')
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 lg:flex lg:flex-col lg:justify-between p-12">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        </div>
        <div className="relative">
          <Logo variant="light" size="lg" />
        </div>
        <div className="relative space-y-6">
          <h2 className="font-display text-4xl font-bold leading-tight text-white max-w-md">
            Factory operations, unified.
          </h2>
          <p className="text-brand-200/90 max-w-md text-lg leading-relaxed">
            Manage production, inventory, sales, and HR for {BRAND.name} — {BRAND.tagline.toLowerCase()}, {BRAND.location}.
          </p>
          <div className="flex gap-6 pt-4">
            {['Production', 'Inventory', 'Sales', 'HR'].map((item) => (
              <div key={item} className="text-center">
                <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-accent-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-brand-400/70">
          © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-[#f4f6f5]">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo size="md" />
            <p className="mt-2 text-sm text-slate-500">{BRAND.tagline}</p>
          </div>

          <div className="card p-8 shadow-elevated">
            <div className="mb-8">
              <h1 className="font-display text-2xl font-bold text-slate-900">
                {isForgot ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {isForgot
                  ? "Enter your account email and we'll send you a link to choose a new password."
                  : isSignUp
                  ? `Join the ${BRAND.shortName} operations portal`
                  : `Sign in to ${BRAND.appName}`}
              </p>
            </div>

            {isForgot && resetSent ? (
              <div className="space-y-5">
                <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
                  If an account exists for <span className="font-semibold">{email}</span>, a reset link is on its way.
                  Check your inbox (and spam folder). The link works for a limited time.
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setIsForgot(false)
                    setResetSent(false)
                  }}
                >
                  Back to sign in
                </Button>
              </div>
            ) : (

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <>
                  <Input
                    label="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Your full name"
                  />
                  <Input
                    label="Job Title"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Machine Operator, Accountant"
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="024 000 0000"
                  />
                </>
              )}
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@purifaventures.com"
              />
              {!isForgot && (
                <div>
                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                  />
                  {!isSignUp && (
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => setIsForgot(true)}
                        className="text-sm font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
              )}
              <Button type="submit" loading={loading} className="w-full !py-3">
                {isForgot ? 'Send reset link' : isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
              {isForgot && (
                <button
                  type="button"
                  onClick={() => setIsForgot(false)}
                  className="block w-full text-center text-sm font-semibold text-brand-700 hover:underline"
                >
                  Back to sign in
                </button>
              )}
            </form>
            )}

            {!isForgot && (
              <>
              <p className="mt-8 text-center text-sm text-slate-500">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
              <p className="mt-3 text-center text-sm text-slate-500">
                Ordering as a customer?{' '}
                <Link to="/customer/signup" className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">
                  Create a company account
                </Link>
              </p>
              </>
            )}
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}
