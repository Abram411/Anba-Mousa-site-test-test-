import { createClient } from '@supabase/supabase-js';

// Read from Vite environment variables, with clean fallback placeholders or runtime saved test credentials
const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('church_supabase_url') || '' : '';
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('church_supabase_key') || '' : '';

export const supabaseUrl = envUrl || storedUrl;
export const supabaseAnonKey = envKey || storedKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Lazy client instantiation with safe fallback
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Helper to safely get the supabase client or throw an instructive error
export function getSupabase() {
  if (!supabase) {
    console.warn(
      'Supabase credentials are not configured in environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).'
    );
  }
  return supabase;
}
