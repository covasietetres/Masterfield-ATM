// Triggering fresh build with updated environment variables
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    if (!isConfigured) {
      const missingVars = [];
      if (!supabaseUrl || supabaseUrl === 'undefined' || supabaseUrl === 'null') missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!supabaseAnonKey || supabaseAnonKey === 'undefined' || supabaseAnonKey === 'null') missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      
      const errorResponse = { 
        data: { user: null, session: null }, 
        error: { message: `Configuración de Supabase incompleta. Faltan: ${missingVars.join(', ')}. Verifica Vercel Settings > Env Vars.` } 
      };

      if (prop === 'auth') {
        return new Proxy({}, {
          get(_, authProp) {
            if (authProp === 'getUser') return async () => ({ data: { user: null }, error: null });
            if (authProp === 'onAuthStateChange') return () => ({ data: { subscription: { unsubscribe: () => {} } } });
            return async () => errorResponse;
          }
        });
      }
      
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

