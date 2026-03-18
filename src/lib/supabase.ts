import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Preferimos avisar en desarrollo si falta configuración de Supabase.
  // En producción, estas variables deben estar definidas en Vercel.
  console.warn(
    "Supabase no está configurado correctamente: faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

