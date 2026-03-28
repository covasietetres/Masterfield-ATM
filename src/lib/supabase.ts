import { createBrowserClient } from '@supabase/ssr';

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
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    if (!isConfigured) {
      console.warn(`Supabase is not configured. Accessing "${String(prop)}" will return undefined.`);
      return undefined;
    }
    
    // Initialize the real client on first access
    if (!target._instance) {
      target._instance = createBrowserClient(supabaseUrl!, supabaseAnonKey!);
    }
    
    const value = target._instance[prop];
    return typeof value === 'function' ? value.bind(target._instance) : value;
  }
});

