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
│   │  Excel Context (Office.js reactivo) ────────│   │
│   │  Tool calls (Office.js: read/write/format…) │   │
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
│   │  1. Verificar JWT (Supabase)                    │   │
│   │  2. Rate limit / cooldown (Upstash Redis)       │   │
│   │  3. Verificar tokens del mes (Redis)            │   │
│   │  4. Truncar contexto Excel según tier           │   │
│   │  5. Extraer texto PDF si hay adjunto (pdf-parse)│   │
│   │  6. Seleccionar proveedor de IA en capas        │   │
│   │  7. Streaming con Vercel AI SDK (tool calls)    │   │
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
│   │   ├── chat/
│   │   │   ├── ChatMessageList.tsx  # Renderiza mensajes + tool call cards
│   │   │   ├── ToolCallCards.tsx    # Tarjetas para cada tool (auto + confirmación)
│   │   │   └── SuggestedFollowups.tsx  # Botones pill de preguntas sugeridas
│   │   ├── auth/               # Pantalla de login (Office Dialog + Supabase)
│   │   ├── billing/            # Contador tokens, pantalla upgrade
│   │   ├── excel/              # Botones de acción sobre el libro
│   │   └── attachments/        # Upload PDFs e imágenes, preview
│   ├── hooks/
│   │   ├── useExcelContext.ts   # Contexto reactivo: hoja activa, usedRange, selectedRange
│   │   ├── useExcelWrite.ts     # write_excel_range (crea hoja si no existe, ajusta rango)
│   │   ├── useExcelTools.ts     # format_range, create_table, sort_range, filter_range, create_chart
│   │   ├── useTokenUsage.ts     # Consulta tokens usados del mes
│   │   ├── useModelSelector.ts  # Estado del modelo seleccionado
│   │   └── useFileAttachment.ts # Manejo de PDFs e imágenes adjuntas
│   ├── lib/
│   │   ├── assistant.ts         # Helpers: prepareChatBody + inyección TSV de contexto Excel
│   │   ├── toolCalls.ts         # Constantes, tipos y parsers de las 10 tools
│   │   ├── api.ts               # fetchWithAuth (JWT de Supabase)
│   │   └── supabase.ts          # Cliente de Supabase
│   ├── pages/
│   │   ├── ChatPage.tsx         # Página principal del task pane
│   │   ├── LoginPage.tsx        # Primera pantalla si no autenticado
│   │   └── UpgradePage.tsx      # Pantalla cuando se agota el límite
│   └── main.tsx
├── public/
│   ├── auth-dialog.html         # Standalone: UI de login — abierta como Office Dialog
│   └── auth-callback.html       # Standalone: captura token OAuth y mensajea al task pane
├── manifest.xml                 # Manifest desarrollo local
├── manifest.vercel.xml          # Manifest producción
├── CLAUDE.md
├── ARCHITECTURE.md              # Este archivo
├── docs/
│   └── BACKEND_TOOL_CALLS.md    # Contrato frontend ↔ backend para tool calls
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
│   │       └── lemon.ts
│   ├── middleware/
│   │   ├── auth.ts              # Verificación de JWT (Supabase)
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
    │                     - Login con email + password (supabase.auth.signInWithPassword)
    │                     - Registro con email + password (supabase.auth.signUp)
    │                     - Muestra "¡Listo!" y pide cerrar ventana manualmente tras éxito
    │               └── `auth-callback.html` obtiene la sesión y llama
    │                     `Office.context.ui.messageParent({ access_token, refresh_token })`
    │               └── LoginPage recibe el mensaje y llama
    │                     `supabase.auth.setSession(...)`
    │
    └── SÍ → ChatPage directamente
              └── supabase.auth.onAuthStateChange detecta cambios de sesión
```

> Google OAuth fue removido por incompatibilidad con WebView de Excel (`disallowed_useragent`).

---

## Flujo de un request de chat

```
Usuario escribe mensaje con datos en la hoja activa
        ↓
onFormSubmit llama getContextForMessage()
        ↓
useExcelContext lee: sheetName, usedRange (address, values, rowCount, columnCount), selectedRange
        ↓
prepareChatBody() en src/lib/assistant.ts:
  - Inyecta los valores de la hoja como bloque TSV en el campo `message`
    [Excel — Hoja: Ventas, Rango: Ventas!A1:D11]
    Producto  Precio  Cantidad  Total
    ...
  - También envía `excelContext` completo como campo separado
        ↓
POST /api/chat {
  message: "[Excel — Hoja: ...]\n...\n\n<pregunta del usuario>",
  excelContext: { sheetName, address, values, rowCount, columnCount, selectedRange },
  attachment?: { base64, mimeType, filename }
}  + Authorization: Bearer <supabase_jwt>
        ↓
Backend: JWT → rate limit → tokens del mes → truncar contexto por tier
        ↓
Backend: construye prompt con contexto Excel + texto PDF + mensaje
        ↓
Proveedor de IA → stream de respuesta (puede incluir tool calls)
        ↓
useChat (Vercel AI SDK v4) recibe el stream token a token
        ↓
Si hay tool calls → useEffect en ChatPage actúa según tipo:
  Auto-execute:    ejecuta Office.js → addToolResult() automáticamente
  Confirmación:    renderiza tarjeta → usuario Aprueba/Cancela → addToolResult()
        ↓
Si hay tool results → AI SDK reenvía al backend automáticamente (maxSteps: 5)
        ↓
Respuesta final del modelo → renderizada en el chat
```

---

## Sistema de tool calls (Fase 1 + Fase 2)

### Tools auto-execute (sin confirmación)
El `useEffect` en `ChatPage.tsx` detecta `state: "call"` y ejecuta:

| Tool | Operación Office.js |
|---|---|
| `read_excel_range` | `sheet.getRange(addr).load(["values",...])` → devuelve datos |
| `list_sheets` | `worksheets.load("name")` → devuelve lista de hojas |
| `navigate_to_cell` | `range.select()` → navega a la celda |
| `highlight_cells` | `range.format.fill.color = color` → resalta celdas |

### Tools con confirmación (tarjeta Aprobar/Cancelar)
`ChatMessageList.tsx` renderiza la tarjeta con preview. `resolvedConfirmToolsRef` en `ChatPage.tsx` previene el loop de re-renderizado:

| Tool | Operación Office.js |
|---|---|
| `write_excel_range` | `sheet.getRange().values = data` (crea hoja si no existe, ajusta rango) |
| `format_range` | `range.format.fill.color`, `font.bold`, `font.color`, `numberFormat` |
| `create_table` | `sheet.tables.add(range, hasHeaders)` |
| `sort_range` | `range.sort.apply([{ key, ascending }])` |
| `filter_range` | `sheet.autoFilter.apply(range, columnIndex, { criterion1 })` |
| `create_chart` | `sheet.charts.add(chartType, dataRange, ChartSeriesBy.auto)` |

### Ciclo de vida de una tool call

```
Backend emite tool call en el stream
        ↓
useChat actualiza messages: toolInvocations[i].state = "call"
        ↓
Auto-execute:                    Con confirmación:
useEffect detecta "call"         ChatMessageList renderiza tarjeta
→ ejecuta Office.js              → usuario hace clic en Aprobar/Cancelar
→ addToolResult({ id, result })  → resolvedConfirmToolsRef.add(id)
                                 → addToolResult({ id, result })
        ↓
useChat actualiza: state = "result"
        ↓
AI SDK envía nueva request al backend con tool results (maxSteps: 5)
        ↓
Backend continúa la conversación → respuesta final del modelo
```

---

## Contexto reactivo de Excel

`useExcelContext.ts` expone:
- `excelContext`: estado React actualizado por listeners (para la UI del task pane)
- `getContextForMessage()`: función async que lee Excel en vivo justo antes de cada mensaje
- `refresh()`: actualiza el estado manualmente

Los listeners registrados:
- `worksheets.onActivated` → refresh inmediato al cambiar de hoja
- `worksheets.onChanged` → refresh con debounce de 400ms al editar datos
- `visibilitychange` → refresh cuando el task pane vuelve a ser visible

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
  message: "[Excel — Hoja: ...]\n...\n\n<pregunta>",
  excelContext: { sheetName, address, values, ... },
  attachment: { base64, mimeType, filename }
}  + Authorization: Bearer <jwt>
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

El frontend maneja los tres tipos de 429 con mensajes diferenciados:
- `Cooldown` → "Espera unos segundos..."
- `hourly` / `rate limit` → "Has enviado demasiados mensajes..."
- `TOKEN_LIMIT_EXCEEDED` → muestra `UpgradePage`

---

## Esquema Supabase (tablas activas)

```sql
users (
  id    TEXT PRIMARY KEY,   -- User ID (Supabase)
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

## Despliegue — estado actual

```
✅ Backend desplegado   → https://axel-addin-backend.vercel.app/api
✅ Frontend desplegado  → https://axel-black.vercel.app
✅ Repo público         → https://github.com/mscnegocio-del/Axel

✅ manifest.vercel.xml actualizado con https://axel-black.vercel.app
✅ Autenticación: Supabase Auth (email/password) via Office Dialog
✅ Tool calls Fase 1: read_excel_range, write_excel_range (preview + Aprobar/Cancelar)
✅ Tool calls Fase 2: list_sheets, navigate_to_cell, highlight_cells (auto), format_range, create_table, sort_range, filter_range, create_chart (con confirmación)
✅ Contexto reactivo de Excel (onActivated + onChanged listeners)
✅ Inyección de datos TSV en el mensaje para garantizar que el modelo vea la hoja
✅ Manejo granular de 429 (cooldown / rate limit / token limit)

Pendiente:
- Configurar Lemon Squeezy producto Pro ($9/mes) y VITE_UPGRADE_URL
- Probar manifest en Excel Online
- Backend: actualizar system prompt para usar excelContext.values directamente
- Backend: implementar suggested followups (dataStream.writeData)
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

**¿Por qué inyectar los datos como TSV en el mensaje?**
El backend recibe `excelContext.values` pero el model prompt puede no incluirlos si el backend no los procesa explícitamente. Inyectarlos como texto en el `message` garantiza que el modelo los vea en la conversación, sin depender del sistema prompt del backend. El backend puede ignorar el campo `excelContext` si ya usa el texto inyectado.

**¿Por qué `addToolResult()` en vez de `reload()` para cerrar tool calls?**
`reload()` hace una nueva request con el estado actual de React, que puede no haber commitado el tool result todavía (race condition). `addToolResult()` del AI SDK v4 actualiza el estado y envía la siguiente request de forma atómica, eliminando el loop de tarjetas.
