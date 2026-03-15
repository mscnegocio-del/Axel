# Axel — Add-in de Excel con IA

Add-in de Excel (task pane) que consume el backend en producción. Ver [ARCHITECTURE.md](ARCHITECTURE.md) y [CLAUDE-publico.md](CLAUDE-publico.md) para contexto completo.

## Requisitos

- Node.js 18+
- Cuenta Clerk y backend desplegado

## Variables de entorno

Copia `.env.example` a `.env` y rellena:

- `VITE_CLERK_PUBLISHABLE_KEY` — desde [Clerk Dashboard](https://dashboard.clerk.com)
- `VITE_BACKEND_URL` — en producción: `https://axel-addin-backend.vercel.app/api`

## Comandos

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run typecheck
npm run lint
```

## Cargar el add-in en Excel

- **Desarrollo:** `npm run dev` → en Excel: Inicio → Complementos → Administrar mis complementos → Cargar → seleccionar `manifest.xml`.
- **Producción:** Tras desplegar en Vercel (ver abajo), actualizar `manifest.vercel.xml` con la URL real del proyecto y cargar ese manifest en Excel.

La app espera a `Office.onReady()` antes de montar React; no uses `Office.context` antes de que el add-in esté listo.

## Despliegue en Vercel (Fase 8)

1. **Conectar el repo** en [Vercel](https://vercel.com) (repo público).
2. **Framework preset:** Vite.
3. **Variables de entorno** en el proyecto de Vercel:
   - `VITE_CLERK_PUBLISHABLE_KEY` — tu clave de Clerk.
   - `VITE_BACKEND_URL` — `https://axel-addin-backend.vercel.app/api`
   - Opcional: `VITE_UPGRADE_URL` — URL de checkout (Lemon Squeezy).
4. **Desplegar** y anotar la URL del add-in (ej: `https://axel-addin-xxx.vercel.app`).
5. **Actualizar `manifest.vercel.xml`:** reemplazar `YOUR_VERCEL_URL` por el subdominio de tu proyecto en Vercel (ej. `axel-addin` o `axel-addin-xxx`), de modo que las URLs queden como `https://axel-addin.vercel.app`. Sustituir en `<SourceLocation DefaultValue="...">` y en los dos `<bt:Url ... DefaultValue="...">` de Resources.
6. **Cargar el manifest en Excel:** Administrar mis complementos → Cargar → seleccionar `manifest.vercel.xml`.

El backend ya está en producción; no hace falta configurarlo.

## Estructura

- `src/components/` — chat, auth, billing, excel, attachments, ui (shadcn)
- `src/hooks/` — useExcelContext, useTokenUsage, useFileAttachment, useModelSelector
- `src/lib/` — assistant, clerk, utils
- `src/pages/` — ChatPage, LoginPage, UpgradePage
