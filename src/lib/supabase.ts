import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from Vite environment variables, with clean fallback placeholders or runtime saved test credentials
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('church_supabase_url') || '' : '';
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('church_supabase_key') || '' : '';

export let supabaseUrl = envUrl || storedUrl;
export let supabaseAnonKey = envKey || storedKey;

export let isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Lazy client instantiation with safe fallback
export let supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Configure or update Supabase client at runtime
 */
export function configureSupabase(url: string, key: string): SupabaseClient | null {
  if (!url || !key) return null;
  supabaseUrl = url;
  supabaseAnonKey = key;
  isSupabaseConfigured = true;
  supabase = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  if (typeof window !== 'undefined') {
    localStorage.setItem('church_supabase_url', url);
    localStorage.setItem('church_supabase_key', key);
  }
  return supabase;
}

// Auto-check server config if client didn't receive via build env
if (typeof window !== 'undefined' && !isSupabaseConfigured) {
  fetch('/api/supabase/config')
    .then(r => r.ok ? r.json() : null)
    .then(cfg => {
      if (cfg && cfg.configured && cfg.url && cfg.anonKey) {
        configureSupabase(cfg.url, cfg.anonKey);
      }
    })
    .catch(() => {});
}

// Helper to safely get the supabase client or throw an instructive error
export function getSupabase() {
  if (!supabase) {
    console.warn(
      'Supabase credentials are not configured in environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).'
    );
  }
  return supabase;
}

