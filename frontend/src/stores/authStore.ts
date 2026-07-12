import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types/database'

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  initialized: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  hasRole: (...roles: UserRole[]) => boolean
  canAccessModule: (module: 'dashboard' | 'production' | 'inventory' | 'sales' | 'hr' | 'settings') => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({ user: session?.user ?? null })

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        set({ profile: profile ?? null })
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        set({ user: session?.user ?? null })
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          set({ profile: profile ?? null })
        } else {
          set({ profile: null })
        }
      })
    } finally {
      set({ loading: false, initialized: true })
    }
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  },

  signUp: async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    return { error: error?.message ?? null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  hasRole: (...roles) => {
    const { profile } = get()
    return profile ? roles.includes(profile.role) : false
  },

  canAccessModule: (module) => {
    const { profile } = get()
    if (!profile) return false
    const role = profile.role

    if (role === 'admin') return true

    switch (module) {
      case 'dashboard':
        return true
      case 'production':
        return role === 'production_supervisor'
      case 'inventory':
        return ['production_supervisor', 'sales_staff'].includes(role)
      case 'sales':
        return role === 'sales_staff'
      case 'hr':
        return role === 'hr_officer' || role === 'staff'
      case 'settings':
        return role === 'admin'
      default:
        return false
    }
  },
}))
