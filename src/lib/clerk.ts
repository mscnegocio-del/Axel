/**
 * Configuración de Clerk para el add-in.
 * La clave se define en .env como VITE_CLERK_PUBLISHABLE_KEY.
 */
export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
