import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lgeigxmjastizxruerwp.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZzFyJXQMdcnwB1Qg4g96rw_skyf-pon';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'erp_sb_session_v2',
    autoRefreshToken: true,
    persistSession: true,
  },
});

export function getSupabase() {
  return Promise.resolve(supabase);
}