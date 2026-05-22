const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('[functions] Supabase service credentials are missing.');
}

const supabaseAdmin = createClient(supabaseUrl || 'https://invalid.local', supabaseServiceRoleKey || 'missing', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabaseAdmin };
