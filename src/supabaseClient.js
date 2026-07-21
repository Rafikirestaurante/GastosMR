import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const supabaseConfigOk = Boolean(supabaseUrl && supabaseKey);
export const supabaseConfigMensaje =
  "Faltan variables de Supabase. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel y vuelve a desplegar sin caché.";

function crearClienteSupabaseSeguro() {
  if (supabaseConfigOk) {
    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "rafiki-supabase-auth-v1",
      },
    });
  }

  console.error(supabaseConfigMensaje);

  // No usamos URL/KEY ficticios: así evitamos errores silenciosos en producción.
  // Si alguna parte del código intenta consultar Supabase sin configuración,
  // fallará con un mensaje claro y rastreable.
  return new Proxy({}, {
    get() {
      throw new Error(supabaseConfigMensaje);
    },
  });
}

export const supabase = crearClienteSupabaseSeguro();
