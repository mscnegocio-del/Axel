# Axel

**Add-in de Excel con IA** — panel de tareas que conecta con un backend en producción para chat con contexto de hoja, adjuntos y control de uso por plan.

[![Node.js](https://img.shields.io/badge/Node.js-18+-3c873a?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite)](https://vitejs.dev)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev)

[Resumen](#resumen) • [Requisitos](#requisitos) • [Configuración](#configuración) • [Desarrollo](#desarrollo) • [Despliegue](#despliegue) • [Estructura](#estructura)

---

## Resumen

Axel es el **frontend del add-in de Excel**: una aplicación React (Vite + TypeScript) que se ejecuta dentro del task pane de Excel. La autenticación la gestiona **Supabase Auth** (via Office Dialog); el chat, el uso de tokens y la lógica de negocio están en un **backend desplegado** (`https://axel-addin-backend.vercel.app/api`). Este repositorio solo contiene el add-in; no incluye el backend.

- **Chat con IA** con contexto reactivo de la hoja activa (Office.js): se actualiza al cambiar de hoja o editar datos.
- **Tool calls de Excel**: el modelo puede leer rangos, escribir datos, formatear celdas, crear tablas, ordenar, filtrar, insertar gráficos y navegar — con tarjetas de confirmación (Aprobar/Cancelar) para las operaciones destructivas.
- **Adjuntos** (PDF) con límites por plan (Free: 1 archivo ≤5MB; Pro: hasta 5 archivos ≤20MB).
- **Uso de tokens** mostrado en la UI; redirección a upgrade cuando se supera el límite del plan.
- **Planes Free/Pro** con redirección a Lemon Squeezy para checkout.

Para decisiones de diseño y arquitectura del sistema completo, ver [ARCHITECTURE.md](ARCHITECTURE.md) y [CLAUDE-publico.md](CLAUDE-publico.md).

## Requisitos

- **Node.js** 18 o superior
- **Proyecto Supabase** (para Auth) configurado con Google y email/password
- El backend ya está en producción; no es necesario clonar ni desplegar el repo del backend

## Configuración

1. Clona el repositorio y entra en la carpeta del proyecto.

2. Instala dependencias:

   ```bash
   npm install
   ```

3. Copia el ejemplo de variables de entorno y rellena los valores:

   ```bash
   cp .env.example .env
   ```

   Variables necesarias:

   | Variable | Descripción |
   |----------|-------------|
   | `VITE_SUPABASE_URL` | URL del proyecto Supabase |
   | `VITE_SUPABASE_ANON_KEY` | Anon key pública de Supabase |
   | `VITE_BACKEND_URL` | URL del API del backend. En producción: `https://axel-addin-backend.vercel.app/api` |
   | `VITE_UPGRADE_URL` | _(Opcional)_ URL de checkout (Lemon Squeezy) para el plan Pro |

> [!NOTE]
> Para desarrollo local contra un backend en otra máquina, usa por ejemplo `VITE_BACKEND_URL=http://localhost:4000/api` en tu `.env`.

## Desarrollo

Inicia el servidor de desarrollo:

```bash
npm run dev
```

La app estará en `http://localhost:5173`.

### Cargar el add-in en Excel

- **Desarrollo:** En Excel: **Inicio** → **Complementos** → **Administrar mis complementos** → **Cargar** → selecciona el archivo `manifest.xml` del proyecto (apunta a `http://localhost:5173`).
- La app espera a `Office.onReady()` antes de montar React; no uses `Office.context` antes de que el add-in esté listo.

Comandos útiles:

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Compilación para producción |
| `npm run typecheck` | Comprobación de tipos (TypeScript) |
| `npm run lint` | ESLint |
| `npm run preview` | Vista previa del build |

## Despliegue

El add-in se despliega como sitio estático en **Vercel**. El backend ya está desplegado por separado.

1. **Conectar el repositorio** en [Vercel](https://vercel.com) (importar el repo de GitHub).

2. **Framework preset:** Vite. Vercel lo detecta automáticamente.

3. **Variables de entorno** en el proyecto de Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_BACKEND_URL` — `https://axel-addin-backend.vercel.app/api`
   - `VITE_UPGRADE_URL` — _(opcional)_ URL de checkout para upgrade.

4. **Desplegar** y anotar la URL del proyecto (ej: `https://axel-addin-xxx.vercel.app`).

5. **Actualizar el manifest de producción:** en `manifest.vercel.xml` sustituye `YOUR_VERCEL_URL` por el subdominio real de tu proyecto en Vercel en:
   - `<SourceLocation DefaultValue="...">`
   - Los dos `<bt:Url ... DefaultValue="...">` dentro de Resources.

6. **Cargar el add-in en Excel (producción):** **Administrar mis complementos** → **Cargar** → selecciona `manifest.vercel.xml`.

> [!IMPORTANT]
> Sin actualizar `manifest.vercel.xml` con la URL real, Excel no podrá cargar el add-in en producción.

## Estructura del proyecto

```
src/
├── components/
│   ├── chat/           # ChatMessageList, ToolCallCards, SuggestedFollowups
│   ├── auth/           # Login via Office Dialog + Supabase
│   ├── billing/        # TokenUsageDisplay, UpgradePage
│   ├── excel/          # Botones de acción
│   └── attachments/    # Upload PDFs, preview
├── hooks/
│   ├── useExcelContext.ts    # Contexto reactivo de Excel (hoja, usedRange, selectedRange)
│   ├── useExcelWrite.ts      # write_excel_range (crea hoja si no existe)
│   ├── useExcelTools.ts      # format_range, create_table, sort_range, filter_range, create_chart
│   ├── useTokenUsage.ts
│   ├── useFileAttachment.ts
│   └── useModelSelector.ts
├── lib/
│   ├── assistant.ts     # prepareChatBody + inyección TSV del contexto Excel
│   ├── toolCalls.ts     # Constantes, tipos y parsers de las 10 tools de Excel
│   ├── api.ts           # fetchWithAuth (JWT de Supabase)
│   └── supabase.ts
├── pages/          # ChatPage, LoginPage, UpgradePage
├── App.tsx
├── main.tsx        # Montaje tras Office.onReady()
└── index.css       # Estilos globales y Tailwind
```

- **Manifests:** `manifest.xml` (desarrollo, localhost) y `manifest.vercel.xml` (producción).
- **`public/auth-dialog.html`** y **`public/auth-callback.html`**: páginas standalone para el flujo de autenticación via Office Dialog API.

## Documentación adicional

- [ARCHITECTURE.md](ARCHITECTURE.md) — Arquitectura del sistema, backend vs add-in, flujos.
- [CLAUDE-publico.md](CLAUDE-publico.md) — Contexto técnico y convenciones del proyecto.
