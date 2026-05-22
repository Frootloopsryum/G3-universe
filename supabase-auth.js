import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-public.js';

export const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
