import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
    session: Session | null
    user: User | null
    profile: Profile | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>
    signUp: (email: string, password: string, fullName: string, role: string) => Promise<{ error: { message: string } | null }>
    signOut: () => Promise<void>
    initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    user: null,
    profile: null,
    loading: true,

    signIn: async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) return { error };

            // Fetch profile for the session
            if (data.session?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.session.user.id)
                    .single();

                if (profile) set({ profile });
            }

            return { error: null };
        } catch (err) {
            console.error('Sign in error:', err);
            return { error: err instanceof Error ? err : { message: String(err) } };
        }
    },

    signUp: async (email, password, fullName, role) => {
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role: role
                    }
                }
            });

            if (error) return { error };

            // Profile is handled by DB trigger, no need to manually insert here
            return { error: null };
        } catch (err) {
            console.error('Sign up error:', err);
            return { error: err instanceof Error ? err : { message: String(err) } };
        }
    },

    signOut: async () => {
        await supabase.auth.signOut()
        set({ session: null, user: null, profile: null })
    },

    initialize: async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession()

            if (error) throw error

            set({ session, user: session?.user ?? null })

            if (session?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single()

                if (profile) set({ profile })
            }
        } catch (error) {
            console.error('Error fetching session:', error)
        } finally {
            set({ loading: false })
        }

        supabase.auth.onAuthStateChange(async (_event, session) => {
            set({ session, user: session?.user ?? null })

            if (session?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single()

                if (profile) set({ profile })
            } else {
                set({ profile: null })
            }
        })
    }
}))
