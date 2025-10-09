import { createClient } from '@supabase/supabase-js'

// Resolve URL safely: if env is missing or clearly a placeholder, use a known-good fallback
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const isValidHttp = /^https?:\/\//i.test(rawUrl)
const isPlaceholder = /your_supabase_url_here/i.test(rawUrl)
const supabaseUrl = isValidHttp && !isPlaceholder
  ? rawUrl
  : 'https://ybxytftngwibgbkvnect.supabase.co'

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Helpful dev logs
if (process.env.NODE_ENV !== 'production') {
  // Log a concise hint without leaking the anon key
  // eslint-disable-next-line no-console
  console.log('Supabase URL:', isValidHttp ? rawUrl : '(fixed to default)')
  // eslint-disable-next-line no-console
  console.log('Anon Key present:', Boolean(supabaseAnonKey))
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// For server-side operations
export const createServerClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    // For Phase 2 we don't require server key; fall back to anon for SSR-safe reads
    return createClient(supabaseUrl, supabaseAnonKey)
  }
  return createClient(supabaseUrl, serviceRoleKey)
}
