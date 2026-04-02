import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Brakuje prawidłowych zmiennych Supabase. Upewnij się, że .env.local zawiera poprawne wartości VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY")
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder')
