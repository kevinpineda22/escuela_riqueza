import { createClient } from "@supabase/supabase-js";
import { setReporterTokenProvider, trackedFetch } from "@/lib/errors/errorReporter";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltan las variables de entorno de Supabase.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // Cada falla (5xx o sin respuesta) queda registrada como plataforma o red.
  global: { fetch: trackedFetch },
});

setReporterTokenProvider(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);
