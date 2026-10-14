// CanchaGo · Supabase client
// Reemplaza los valores con los de tu proyecto en supabase.com → Settings → API

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const SUPABASE_URL  = 'REEMPLAZAR_CON_TU_PROJECT_URL';
const SUPABASE_KEY  = 'REEMPLAZAR_CON_TU_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
