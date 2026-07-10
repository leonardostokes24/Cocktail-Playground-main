import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycapgvrnvipgfiglzzmg.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  throw new Error('VITE_SUPABASE_ANON_KEY is not set — add it to your .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
