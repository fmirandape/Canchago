// CanchaGo · Supabase client
// Reemplaza los valores con los de tu proyecto en supabase.com → Settings → API

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const SUPABASE_URL  = 'https://xqklrfzhpywbyxhskvtq.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_nwWnl9ohsydrFtzmGjJz4A_dGodbr8D';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
