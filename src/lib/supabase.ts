import { createBrowserClient } from '@supabase/ssr';
import { type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Robust check for environment variables
const isConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'undefined' && 
  supabaseUrl !== 'null' &&
  supabaseAnonKey !== 'undefined' &&
  supabaseAnonKey !== 'null'
);

// Lazy initialization using a Proxy to prevent ANY call to createBrowserClient during builds/prerendering
// We cast to SupabaseClient to satisfy TypeScript's type checking in other files
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    if (!isConfigured) {
      // Return a dummy object that won't crash on common accesses if used carefully
      // but warn the developer
      console.warn(`Supabase is not configured. Accessing "${String(prop)}" during build.`);
      
      // Handle nested access (like supabase.auth.getUser())
      if (prop === 'auth') {
        return {
          getUser: async () => ({ data: { user: null }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        };
      }
      return undefined;
    }
    
    // Initialize the real client on first access
    if (!target._instance) {
      target._instance = createBrowserClient(supabaseUrl!, supabaseAnonKey!);
    }
    
    const value = target._instance[prop];
    return typeof value === 'function' ? value.bind(target._instance) : value;
  }
}) as SupabaseClient;

