import { supabase } from "@/lib/supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Obtiene los headers de autorización con el JWT de Supabase.
 * Usar en todas las llamadas al backend (POST /api/chat, GET /api/usage).
 * Lanza si no hay sesión para no enviar "Bearer null".
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  if (token == null) {
    throw new Error("No hay sesión activa. Inicia sesión para usar el backend.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * URL base del backend. Nunca llamar a proveedores de IA directamente.
 */
export function getBackendUrl(): string {
  return BACKEND_URL ?? "";
}

/**
 * fetch al backend usando los headers de autorización actuales
 * (JWT obtenido desde la sesión de Supabase).
 */
export async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${getBackendUrl().replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const headers = new Headers(await getAuthHeaders());
  const existingHeaders = new Headers(options.headers);
  existingHeaders.forEach((value, key) => headers.set(key, value));
  return fetch(url, { ...options, headers });
}
