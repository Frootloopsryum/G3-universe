import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle';

let publicConfigPromise;
let publicClientPromise;

async function fetchPublicConfig() {
  const response = await fetch('/.netlify/functions/public-config');
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || 'Public config could not be loaded.');
  }

  if (!payload?.url || !payload?.anonKey) {
    throw new Error('Public Supabase config is incomplete.');
  }

  return payload;
}

export async function getPublicConfig() {
  if (!publicConfigPromise) {
    publicConfigPromise = fetchPublicConfig();
  }
  return publicConfigPromise;
}

export async function createSupabaseBrowserClient(authOverrides = {}) {
  const { url, anonKey } = await getPublicConfig();
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      ...authOverrides,
    },
  });
}

export async function getSupabasePublic() {
  if (!publicClientPromise) {
    publicClientPromise = createSupabaseBrowserClient();
  }
  return publicClientPromise;
}
