import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycapgvrnvipgfiglzzmg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYXBndnJudmlwZ2ZpZ2x6em1nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc5MzQyNiwiZXhwIjoyMDkyMzY5NDI2fQ.71_l6ALoH562OQlsayRJu1SyzTWcS3JEwupzoWKu3cs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
