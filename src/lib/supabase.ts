import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('[DEBUG] supabase.ts - URL:', supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : 'MISSING');
console.log('[DEBUG] supabase.ts - AnonKey:', supabaseAnonKey ? 'PRESENT' : 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[DEBUG] Supabase environment variables are missing! Check your .env file or Vite config.');
}

export const supabase = createClient<Database>(supabaseUrl || '', supabaseAnonKey || '')
