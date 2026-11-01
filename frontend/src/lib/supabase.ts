import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cqehdynfeicqpektxuit.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_e1keRaa6ub-6B31xOE8Zbw_9c5bxWMt'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Publishable Key missing in environment. Multi-tenant SaaS features will require configuration.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
})

