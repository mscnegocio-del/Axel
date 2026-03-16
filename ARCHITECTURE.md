# ARCHITECTURE.md — Axel — Decisiones técnicas y diseño del sistema

---

## Visión general

**Axel** es un add-in de Excel con agente de IA. El sistema se divide en dos repos separados. El repo público contiene el add-in React que corre dentro de Excel. El repo privado contiene el backend con auth, billing y proxy de IA — **ya desplegado y funcionando en producción.**

| Repo | Visibilidad | Estado | URL |
|---|---|---|---|
| `github.com/mscnegocio-del/Axel` | Público | ✅ En producción | `https://axel-black.vercel.app` |
| `github.com/mscnegocio-del/Axel-addin-backend` | Privado | ✅ En producción | `https://axel-addin-backend.vercel.app/api` |

El add-in nunca llama directamente a GROQ ni Cloudflare — siempre pasa por el backend privado.

---

## Diagrama de arquitectura

```
┌─────────────────────────────────────────────────────┐
│                  Microsoft Excel                      │
│                                                       │
│   ┌─────────────────────────────────────────────┐   │
│   │           Task Pane (Office Add-in)          │   │
│   │         REPO PÚBLICO: Axel                   │   │
│   │                                              │   │
│   │   React + Vite + Tailwind                    │   │
│   │                                              │   │
│   │  Chat UI ←── streaming (Vercel AI SDK) ────│───│──→ axel-addin-backend.vercel.app
│   │  Auth UI ←── Supabase session ─────────────│───│──→ Supabase Auth
│   │  Excel Context (Office.js) ─────────────────│   │
│   │  PDF adjunto (base64) ──────────────────────│   │
│   └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│   REPO PRIVADO: Axel-addin-backend ✅ EN PRODUCCIÓN       │
│   https://axel-addin-backend.vercel.app/api              │
│   Vercel Node.js Functions                               │
│                                                          │
│   POST /api/chat                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │  1. Verificar JWT (Clerk)                       │   │
│   │  2. Rate limit / cooldown (Upstash Redis)       │   │
│   │  3. Verificar tokens del mes (Redis)            │   │
│   │  4. Truncar contexto Excel segun tier           │   │
│   │  5. Extraer texto PDF si hay adjunto (pdf-parse)│   │
│   │  6. Seleccionar proveedor de IA en capas        │   │
│   │  7. Streaming con Vercel AI SDK                 │   │
│   │  8. Sumar tokens usados (Redis + Supabase)      │   │
│   └─────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
          │              │              │
          ▼              ▼              ▼
   Cloudflare AI      GROQ API     API key propia
   (primera capa,   (segunda capa   del usuario
    free tier)       + Pro tier)

┌──────────────┐  ┌──────────────┐
│ Upstash Redis│  │   Supabase   │
│              │  │              │
│ Rate limiting│  │ users +      │
│ Token counts │  │ token_usage  │
│ Cooldowns    │  │ (sin historial│
└──────────────┘  │ de chat)     │
                  └──────────────┘

┌──────────────┐
│ Lemon Squeezy│
│ Suscripciones│
│ Webhooks     │
└──────────────┘
```

---

## Estructura de carpetas

### Repo público (Axel — add-in)

```
Axel/
├── src/
│   ├── components/
│   │   ├── chat/               # UI de chat + tool call cards
│   │   ├── auth/               # Pantalla de login (Office Dialog + Supabase)
│   │   ├── billing/            # Contador tokens, pantalla upgrade
│   │   ├── excel/              # Botones de acción sobre el libro
│   │   └── attachments/        # Upload PDFs e imágenes, preview
│   ├── hooks/
│   │   ├── useExcelContext.ts   # Lee rango seleccionado via Office.js
│   │   ├── useTokenUsage.ts     # Consulta tokens usados del mes
│   │   ├── useModelSelector.ts  # Estado del modelo seleccionado
│   │   └── useFileAttachment.ts # Manejo de PDFs e imágenes adjuntas
│   ├── lib/
│   │   ├── assistant.ts         # Helpers para cuerpo de /chat y tool calls
│   │   └── supabase.ts          # Cliente de Supabase
│   ├── pages/
│   │   ├── ChatPage.tsx         # Página principal del task pane
│   │   ├── LoginPage.tsx        # Primera pantalla si no autenticado
│   │   └── UpgradePage.tsx      # Pantalla cuando se agota el límite
│   └── main.tsx
├── manifest.xml                 # Manifest desarrollo local
├── manifest.vercel.xml          # Manifest producción
├── CLAUDE.md
├── ARCHITECTURE.md              # Este archivo
├── vite.config.ts
└── package.json
```

### Repo privado (Axel-addin-backend) — ya construido

```
Axel-addin-backend/
├── src/
│   ├── app.ts                   # App Hono (basePath /api)
│   ├── server.ts                # Servidor local desarrollo
│   ├── types.ts                 # Tipos compartidos
│   ├── routes/
│   │   ├── chat.ts              # POST /api/chat
│   │   ├── usage.ts             # GET /api/usage
│   │   └── webhooks/
│   │       ├── clerk.ts
│   │       └── lemon.ts
│   ├── middleware/
│   │   ├── auth.ts              # Verificación de JWT (Supabase / backend propio)
│   │   └── rateLimit.ts         # Upstash
│   ├── providers/
│   │   ├── index.ts             # Selección en capas
│   │   ├── cloudflare.ts
│   │   ├── groq.ts
│   │   └── custom.ts
│   ├── db/
│   │   ├── schema.sql
│   │   └── client.ts
│   └── lib/
│       ├── tokens.ts
│       ├── tiers.ts
│       └── pdf.ts               # Extracción PDF en memoria
└── package.json
```

---

## Flujo de autenticación (Supabase + Office Dialog)

```
Primera vez que el usuario abre el add-in:

Task Pane carga
    │
    ▼
Supabase detecta: ¿hay sesión activa?
    │
    ├── NO → LoginPage
    │         └── Botón "Log in" abre Office Dialog
    │               └── `auth-dialog.html` (dominio público) maneja:
    │                     - Login con Google (Supabase OAuth)
    │                     - Login / registro con email + password
    │               └── `auth-callback.html` obtiene la sesión y llama
    │                     `Office.context.ui.messageParent({ access_token, refresh_token })`
    │               └── LoginPage recibe el mensaje y llama
    │                     `supabase.auth.setSession(...)`
    │
    └── SÍ → ChatPage directamente
```

---

## Flujo de un request de chat con PDF adjunto

```
Usuario adjunta PDF + escribe mensaje en el task pane
        ↓
Frontend valida tamaño (Free: ≤5MB x1 / Pro: ≤20MB x5)
        ↓
Frontend convierte PDF a base64
        ↓
POST /api/chat {
  message: "...",
  excelContext: { range, sheetName, data },
  attachment: { base64, mimeType, filename }
}  + Authorization: Bearer <jwt>
        ↓
Backend: JWT → rate limit → tokens del mes
        ↓
Backend: extrae texto PDF con pdf-parse (en memoria)
        ↓
Backend: construye prompt con contexto Excel + texto PDF + mensaje
        ↓
Proveedor de IA → stream de respuesta
        ↓
PDF descartado — cero persistencia
        ↓
Tokens sumados al contador mensual en Redis + Supabase
```

---

## Flujo de un request de chat sin adjunto

```
Usuario escribe mensaje y tiene celdas seleccionadas
        ↓
POST /api/chat {
  message: "...",
  excelContext: { range, sheetName, data }
}  + Authorization: Bearer <jwt>
        ↓
Backend: JWT → rate limit → tokens → truncar contexto por tier
        ↓
Cloudflare AI (primera capa) → si falla → GROQ (segunda capa)
        ↓
Stream → frontend → `useChat` (Vercel AI SDK) renderiza token a token
        ↓
Historial guardado SOLO en estado de React del cliente
Al cerrar Excel → historial desaparece (por diseño, privacidad)
```

---

## Decisión de privacidad: sin persistencia de historial

El historial de chat **no se guarda en el servidor**. Vive únicamente en el estado de React del cliente mientras el add-in está abierto. Al cerrar Excel o el add-in, desaparece.

Las tablas `conversations` y `messages` existen en el schema de Supabase pero no se usan. Esta decisión es intencional — los usuarios de Excel trabajan con datos sensibles (financieros, contables) y no queremos almacenarlos.

**Lo que sí persiste en Supabase:** `users` y `token_usage` únicamente.

---

## Flujo de selección de proveedor de IA

```
¿Tier Free?
    │
    ├── SÍ → Cloudflare Workers AI (primera capa, gratis)
    │         ├── OK → stream
    │         └── FALLA → GROQ Llama 3.1 8B (free tier)
    │                       ├── OK → stream
    │                       └── FALLA → 429 + upgradeUrl
    │
    └── Pro → ¿API key propia?
               ├── SÍ → proveedor del usuario
               └── NO → GROQ Llama 3.3 70B / Llama 4
```

> ⚠️ El rate limit de GROQ aplica por organización (tu API key), no por usuario.
> Cloudflare como primera capa protege ese límite compartido.

---

## Rate limiting (en el backend — ya implementado)

```
Solo tier Free:
1. cooldown:{userId}              TTL: 5s     → 1 request cada 5s
2. hourly:{userId}:{YYYY-MM-DD-HH} TTL: 1h    → máx 20 req/hora
3. monthly:{userId}:{YYYY-MM}     TTL: fin mes → máx 50,000 tokens
```

---

## Esquema Supabase (tablas activas)

```sql
users (
  id    TEXT PRIMARY KEY,   -- User ID (Supabase / backend)
  email TEXT NOT NULL,
  tier  TEXT DEFAULT 'free' -- 'free' | 'pro'
)

token_usage (
  user_id     TEXT REFERENCES users(id),
  month       TEXT NOT NULL,       -- 'YYYY-MM'
  tokens_used INTEGER DEFAULT 0,
  UNIQUE(user_id, month)
)
```

---

## Escalabilidad y costos de IA

| Fase | Usuarios | Proveedor | Costo IA |
|---|---|---|---|
| Early stage | <500 | GROQ free tier | **$0** |
| Crecimiento | 500–2,000 | Cloudflare → GROQ free | **$0** |
| Escala | 2,000+ | Cloudflare + GROQ pago | $5–20/mes |

---

## Despliegue — estado actual y próximos pasos

```
✅ Backend desplegado   → https://axel-addin-backend.vercel.app/api
✅ Frontend desplegado  → https://axel-black.vercel.app
✅ Repo público         → https://github.com/mscnegocio-del/Axel

- **manifest.vercel.xml** actualizado con `https://axel-black.vercel.app`
- **Tool calls en el chat:** tarjetas "Leyendo rango…" y "Escribir datos" (preview + Aprobar/Cancelar) cuando el backend envía tool calls compatibles con AI SDK v4. El frontend usa `useChat` (`ai/react`) con `maxSteps` y `addToolResult` para cerrar el ciclo de tools. Coordinación backend: [docs/BACKEND_TOOL_CALLS.md](docs/BACKEND_TOOL_CALLS.md)
- Configurar Lemon Squeezy producto Pro ($9/mes) y `VITE_UPGRADE_URL`
- Configurar Supabase Auth (Google + email/password) para el dominio del add-in (`https://axel-black.vercel.app`)
- Probar manifest en Excel Online
```

---

## Decisiones técnicas y su justificación

**¿Por qué dos repos y no un monorepo?**
El add-in es open source — cualquiera puede verlo. La lógica de billing, rate limiting y estrategia de proveedores es ventaja competitiva. Separar permite ser open source sin regalar el negocio.

**¿Por qué Vite y no Next.js?**
Un task pane de Excel es una app estática embebida. Vite genera un bundle estático puro que Office.js carga directamente. Next.js agrega SSR y routing innecesarios.

**¿Por qué Hono en Node.js y no Edge Functions?**
pdf-parse requiere Node.js — no es compatible con el runtime de Edge. El backend corre en Vercel Node.js Functions, que sigue siendo serverless y escala automáticamente, con cold starts aceptables.

**¿Por qué sin persistencia de historial?**
Los usuarios de Excel manejan datos financieros y contables sensibles. No almacenar conversaciones es un diferenciador de privacidad frente a Shortcut.ai, ChatGPT for Excel y Copilot. El historial en sesión es suficiente para el flujo de trabajo.

**¿Por qué Cloudflare AI como primera capa?**
El free tier de GROQ aplica por organización. Con alta concurrencia, múltiples usuarios comparten el mismo límite. Cloudflare distribuye esa presión y es genuinamente gratis.

**¿Por qué Lemon Squeezy y no Stripe?**
Stripe no opera en Perú como merchant. Lemon Squeezy es Merchant of Record, maneja taxes globales, y tiene buena DX para indie developers. Compatible con Payoneer y Wise para recibir pagos.

**¿Por qué assistant-ui?**
Streaming, auto-scroll, accesibilidad, tool calls como componentes, estados de carga — resuelto. 8,600+ stars, usado en producción por LangChain y Browser Use. Alternativa a construir semanas de UI desde cero.
