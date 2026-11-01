import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url?: string | null
}

export interface TenantRestaurant {
  id: string
  name: string
  slug: string
  currency: string
  currency_symbol: string
  timezone: string
  operational_model: string
  created_at: string
}

export interface TenantBranch {
  id: string
  restaurant_id: string
  branch_code: string
  branch_name: string
  city: string
  state?: string | null
  is_primary: boolean
  is_active: boolean
}

export interface TenantMembership {
  id: string
  restaurant_id: string
  user_id: string
  role: 'owner' | 'admin' | 'analyst'
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  restaurants: TenantRestaurant[]
  currentRestaurant: TenantRestaurant | null
  currentBranch: TenantBranch | null
  branches: TenantBranch[]
  userRole: 'owner' | 'admin' | 'analyst' | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; data?: any }>
  signOut: () => Promise<void>
  selectRestaurant: (restaurantId: string) => Promise<void>
  selectBranch: (branchId: string | null) => void
  refreshTenants: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  restaurants: [],
  currentRestaurant: null,
  currentBranch: null,
  branches: [],
  userRole: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  selectRestaurant: async () => {},
  selectBranch: () => {},
  refreshTenants: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [restaurants, setRestaurants] = useState<TenantRestaurant[]>([])
  const [currentRestaurant, setCurrentRestaurant] = useState<TenantRestaurant | null>(null)
  const [branches, setBranches] = useState<TenantBranch[]>([])
  const [currentBranch, setCurrentBranch] = useState<TenantBranch | null>(null)
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'analyst' | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Configure axios to always send Supabase JWT when authenticated
  useEffect(() => {
    const interceptor = api.interceptors.request.use((config) => {
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
      }
      return config
    })

    return () => {
      api.interceptors.request.eject(interceptor)
    }
  }, [session])

  const fetchTenantsForUser = async (currentSession: Session) => {
    try {
      const response = await api.get('/tenant/restaurants', {
        headers: { Authorization: `Bearer ${currentSession.access_token}` }
      })
      const userRestaurants: TenantRestaurant[] = response.data || []
      setRestaurants(userRestaurants)

      if (userRestaurants.length > 0) {
        const savedId = localStorage.getItem('restroiq_selected_restaurant_id')
        const matched = userRestaurants.find(r => r.id === savedId) || userRestaurants[0]
        setCurrentRestaurant(matched)
        localStorage.setItem('restroiq_selected_restaurant_id', matched.id)
        await loadBranchesAndRole(matched.id, currentSession)
      } else {
        setCurrentRestaurant(null)
        setBranches([])
        setCurrentBranch(null)
        setUserRole(null)
      }
    } catch (err) {
      console.error('Error fetching tenant restaurants:', err)
    }
  }

  const loadBranchesAndRole = async (restaurantId: string, currentSession: Session) => {
    try {
      // 1. Fetch branches
      const branchRes = await api.get(`/tenant/restaurants/${restaurantId}/branches`, {
        headers: { Authorization: `Bearer ${currentSession.access_token}` }
      })
      const branchList: TenantBranch[] = branchRes.data || []
      setBranches(branchList)

      // Set default primary branch
      const primary = branchList.find(b => b.is_primary) || branchList[0] || null
      setCurrentBranch(primary)

      // 2. Fetch members to identify user role
      const memberRes = await api.get(`/tenant/restaurants/${restaurantId}/members`, {
        headers: { Authorization: `Bearer ${currentSession.access_token}` }
      })
      const members: any[] = memberRes.data || []
      const myMembership = members.find(m => m.user_id === currentSession.user.id)
      setUserRole(myMembership?.role || 'owner')
    } catch (err) {
      console.error('Error loading branches/role for restaurant:', err)
    }
  }

  useEffect(() => {
    // 1. Initial session load
    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      setSession(initSession)
      setUser(initSession?.user ?? null)
      if (initSession?.user) {
        setProfile({
          id: initSession.user.id,
          email: initSession.user.email || '',
          full_name: initSession.user.user_metadata?.full_name || initSession.user.email?.split('@')[0] || 'User',
          avatar_url: initSession.user.user_metadata?.avatar_url
        })
        fetchTenantsForUser(initSession).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // 2. Auth state subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (newSession?.user) {
        setProfile({
          id: newSession.user.id,
          email: newSession.user.email || '',
          full_name: newSession.user.user_metadata?.full_name || newSession.user.email?.split('@')[0] || 'User',
          avatar_url: newSession.user.user_metadata?.avatar_url
        })
        await fetchTenantsForUser(newSession)
      } else {
        setProfile(null)
        setRestaurants([])
        setCurrentRestaurant(null)
        setBranches([])
        setCurrentBranch(null)
        setUserRole(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    if (data?.session) {
      setSession(data.session)
      setUser(data.user)
      await fetchTenantsForUser(data.session)
    }
    return { error: error ? new Error(error.message) : null }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    })
    return { error: error ? new Error(error.message) : null, data }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('restroiq_selected_restaurant_id')
    setSession(null)
    setUser(null)
    setProfile(null)
    setCurrentRestaurant(null)
    setRestaurants([])
  }

  const selectRestaurant = async (restaurantId: string) => {
    const found = restaurants.find(r => r.id === restaurantId)
    if (found && session) {
      setCurrentRestaurant(found)
      localStorage.setItem('restroiq_selected_restaurant_id', found.id)
      await loadBranchesAndRole(found.id, session)
    }
  }

  const selectBranch = (branchId: string | null) => {
    if (!branchId) {
      setCurrentBranch(null)
      return
    }
    const found = branches.find(b => b.id === branchId)
    if (found) setCurrentBranch(found)
  }

  const refreshTenants = async () => {
    if (session) {
      await fetchTenantsForUser(session)
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      restaurants,
      currentRestaurant,
      currentBranch,
      branches,
      userRole,
      loading,
      signIn,
      signUp,
      signOut,
      selectRestaurant,
      selectBranch,
      refreshTenants
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

