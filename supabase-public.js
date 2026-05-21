import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle';

export const SUPABASE_URL = 'https://foarlngpaotkbsvtqqwm.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYXJsbmdwYW90a2JzdnRxcXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDY1NjgsImV4cCI6MjA5MTI4MjU2OH0.6BJM1jOw1nL9Tm7bkg7JwcYuE_voBG5bga2fsv9iYIU';

export const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
