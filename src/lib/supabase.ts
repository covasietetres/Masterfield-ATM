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
      if (typeof window !== 'undefined') {
        console.warn(`Supabase is not configured. Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.`);
      }
      
        const errorResponse = { 
          data: { user: null, session: null }, 
          error: { message: 'Configuración de Supabase incompleta (Deploy 2). Verifica las variables de entorno en Vercel.' } 
        };

      if (prop === 'auth') {
        return new Proxy({}, {
          get(_, authProp) {
            if (authProp === 'getUser') return async () => ({ data: { user: null }, error: null });
            if (authProp === 'onAuthStateChange') return () => ({ data: { subscription: { unsubscribe: () => {} } } });
            
            // For any other auth method (signInWithPassword, signUp, etc.)
            return async () => errorResponse;
          }
        });
      }
      
      // Catch-all for other top-level properties (from, rpc, etc.)
      return () => ({
        select: () => ({ error: errorResponse.error }),
        insert: () => ({ error: errorResponse.error }),
        update: () => ({ error: errorResponse.error }),
        delete: () => ({ error: errorResponse.error }),
        rpc: () => ({ error: errorResponse.error }),
      });
    }
    
    if (!target._instance) {
      target._instance = createBrowserClient(supabaseUrl!, supabaseAnonKey!);
    }
    
    const value = target._instance[prop];
    return typeof value === 'function' ? value.bind(target._instance) : value;
  }
}) as SupabaseClient;

