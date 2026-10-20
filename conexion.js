// =====================================================================
//  conexion.js — Conexión a Supabase
//  Para usar el sistema con otra base, cambiá solo estos dos valores.
// =====================================================================
const SUPABASE_URL = 'https://plustdhhsxrezgikkwzn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_woeEPjL619DvM9jnCrEfdQ_RbrHwo9C';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,       // la sesión dura mientras el navegador esté abierto (ver logica.js)
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    // Seguridad: el navegador nunca guarda en caché las respuestas con datos
    fetch: (url, opciones = {}) => fetch(url, { ...opciones, cache: 'no-store' }),
  },
});
