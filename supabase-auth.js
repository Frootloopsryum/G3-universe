import { createSupabaseBrowserClient } from './supabase-public.js';

let authClientPromise;

export async function getSupabaseAuth() {
  if (!authClientPromise) {
    authClientPromise = createSupabaseBrowserClient({
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    });
  }

  return authClientPromise;
}
