import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

const ACCESS_TOKEN_REFRESH_BUFFER_SEC = 120

/**
 * Returns a JWT suitable for `Authorization: Bearer` on Supabase Storage/REST.
 * Refreshes the session when the access token is missing, expired, or within the buffer window
 * so callers are not stuck with a stale token from app state after idle tabs.
 */
export async function getValidAccessToken(): Promise<string | undefined> {
    const {
        data: { session },
        error,
    } = await supabase.auth.getSession()
    if (error || !session?.access_token) return undefined

    const exp = session.expires_at
    const nowSec = Date.now() / 1000
    const needsRefresh = exp == null || exp <= nowSec + ACCESS_TOKEN_REFRESH_BUFFER_SEC
    if (!needsRefresh) return session.access_token

    const { data, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !data.session?.access_token) return undefined
    return data.session.access_token
}
