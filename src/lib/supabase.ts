import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dwleahipbhdmniqjlizt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3bGVhaGlwYmhkbW5pcWpsaXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDg5NDcsImV4cCI6MjA4NzIyNDk0N30.qQ2c32kEFgv7rbidEh_wSSBVN8fQUwMjLsqSA2mr_ok';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: window.sessionStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
