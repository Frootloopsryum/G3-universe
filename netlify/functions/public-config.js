const { json } = require('./lib/http');

exports.handler = async function handler() {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return json(500, {
      error: 'Public Supabase config is missing. Add SUPABASE_URL and SUPABASE_ANON_KEY in Netlify.',
    });
  }

  return json(200, { url, anonKey });
};
