# CLAUDE.md — Axel Add-in (repo público)

Este es el repo **público**. Contiene el add-in de Excel — lo que el usuario ve e instala.
Toda la lógica de auth, billing, modelos de IA y rate limiting vive en el **backend privado ya desplegado**.

**Backend en producción:** `https://axel-addin-backend.vercel.app/api`
**Frontend en producción:** `https://axel-black.vercel.app`
**Repo público:** `https://github.com/mscnegocio-del/Axel`

Lee `ARCHITECTURE.md` para entender el sistema completo antes de tocar código.

---

## Qué hace este repo

- Renderiza el task pane dentro de Microsoft Excel (Office Add-in)
- Muestra la UI de chat con streaming usando **Vercel AI SDK** (`useChat` de `ai/react`) y componentes propios
- Autentica al usuario con **Supabase Auth** (email/password) usando el Office Dialog API (`public/auth-dialog.html` y `public/auth-callback.html`)
- Lee el contexto de Excel **reactivamente** (rango seleccionado, hoja activa, datos del rango usado) via Office.js — se actualiza al cambiar de hoja o editar datos
- Inyecta los datos de la hoja activa directamente en el mensaje antes de enviarlo al backend (como bloque TSV), para que el modelo siempre los vea aunque el backend no procese `excelContext.values`
- Permite adjuntar PDFs e imágenes al chat (se envían como base64 al backend)
- Envía requests al backend privado — nunca directamente a GROQ ni Cloudflare
- Muestra el contador de tokens y pantalla de upgrade
- **Ejecuta tool calls de Office.js** iniciadas por el backend:
  - **Auto-execute** (sin confirmación): `read_excel_range`, `list_sheets`, `navigate_to_cell`, `highlight_cells`
  - **Con confirmación** (tarjeta Aprobar/Cancelar): `write_excel_range`, `format_range`, `create_table`, `sort_range`, `filter_range`, `create_chart`
- Muestra suggested followups al final de cada respuesta (via `message.annotations`)
- El historial de chat es solo en sesión (en memoria del cliente) — no se persiste

---

## Relación con el backend privado

| Este repo (add-in) | Backend privado |
|---|---|
| `github.com/mscnegocio-del/Axel` | `github.com/mscnegocio-del/Axel-addin-backend` (privado) |
| Corre dentro de Excel (task pane) | Corre en Vercel Node.js Functions |
| Solo UI + Office.js | Auth, billing, IA, rate limiting |

**Este repo NO contiene lógica de negocio. Solo consume endpoints del backend.**

### Endpoints que consume
```
POST https://axel-addin-backend.vercel.app/api/chat   → envía mensaje + contexto Excel + adjuntos
GET  https://axel-addin-backend.vercel.app/api/usage  → obtiene tokens usados este mes
```

Todos los requests incluyen un JWT de Supabase:
```
Authorization: Bearer <supabase_access_token>
```

---

## Estructura de carpetas

```
/
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatMessageList.tsx  # Renderiza mensajes + tool call cards
│   │   │   ├── ToolCallCards.tsx    # Tarjetas para cada tool (auto + confirmación)
│   │   │   └── SuggestedFollowups.tsx  # Botones pill de preguntas sugeridas
│   │   ├── auth/               # Pantalla de login (Office Dialog + Supabase)
│   │   ├── billing/            # Contador de tokens, pantalla de upgrade
│   │   ├── excel/              # Botones de acción sobre el libro
│   │   └── attachments/        # Upload de PDFs e imágenes, preview
│   ├── hooks/
│   │   ├── useExcelContext.ts   # Contexto reactivo de Excel (hoja, usedRange, selectedRange)
│   │   ├── useExcelWrite.ts     # Escritura en Excel (write_excel_range) con creación de hoja si no existe
│   │   ├── useExcelTools.ts     # Hooks para tools de confirmación: format, table, sort, filter, chart
│   │   ├── useTokenUsage.ts     # Consulta tokens usados del mes
│   │   ├── useModelSelector.ts  # Estado del modelo seleccionado
│   │   └── useFileAttachment.ts # Manejo de PDFs e imágenes adjuntas
│   ├── lib/
│   │   ├── assistant.ts         # Helpers para el body de /chat (inyección TSV de contexto Excel)
│   │   ├── toolCalls.ts         # Constantes, tipos y parsers para todas las tools
│   │   ├── api.ts               # fetchWithAuth — añade JWT de Supabase a cada request
│   │   └── supabase.ts          # Cliente de Supabase
│   ├── pages/
│   │   ├── ChatPage.tsx         # Página principal del task pane
│   │   ├── LoginPage.tsx        # Primera pantalla si no está autenticado
│   │   └── UpgradePage.tsx      # Pantalla cuando se agota el límite
│   └── main.tsx
├── public/
│   ├── auth-dialog.html         # Standalone: UI de login (email/password) — Office Dialog
│   └── auth-callback.html       # Standalone: captura token OAuth y lo envía al task pane
├── manifest.xml                 # Manifest para desarrollo local
├── manifest.vercel.xml          # Manifest para producción
├── CLAUDE.md
├── ARCHITECTURE.md
├── docs/
│   └── BACKEND_TOOL_CALLS.md    # Contrato frontend ↔ backend para tool calls
├── index.html
├── vite.config.ts
└── package.json
```

---

## Stack — no cambies esto sin justificación

- **React 18 + TypeScript** — sin excepciones
- **Vite** — bundler, genera static files para el task pane
- **Tailwind CSS v4** — utility classes únicamente
- **shadcn/ui** — componentes base
- **Supabase** (`@supabase/supabase-js`) — autenticación (email/password)
- **Vercel AI SDK** (`ai` v4) — `useChat` de `ai/react` para streaming de chat y tool calls
- **Office.js** (`@types/office-js`) — interacción con Excel y Office Dialog API

---

## Variables de entorno

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_BACKEND_URL=https://axel-addin-backend.vercel.app/api
VITE_UPGRADE_URL=https://tudemo.lemonsqueezy.com/checkout   # opcional
```

Para desarrollo local apuntando al backend en producción:
```
VITE_BACKEND_URL=https://axel-addin-backend.vercel.app/api
```

Para desarrollo local con backend local:
```
VITE_BACKEND_URL=http://localhost:4000/api
```

---

## Comandos

```bash
# Instalar dependencias
npm install

# Desarrollo local
npm run dev
# → task pane disponible en http://localhost:5173

# Build de producción
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

---

## Convenciones de código

- Componentes funcionales únicamente — sin class components
- Nombres de componentes en PascalCase: `ChatPanel.tsx`
- Un componente por archivo
- No uses `React.FC` — declara el componente directamente
- Tipos inline o `type Props = {}` — no interfaces para props simples
- Strict TypeScript — no uses `any`

---

## Sistema de tool calls

Las tools son iniciadas por el backend en el stream. El frontend las detecta en `message.toolInvocations` y actúa según el tipo:

### Auto-execute (sin confirmación del usuario)
El `useEffect` en `ChatPage.tsx` detecta `state: "call"` y ejecuta automáticamente via Office.js, luego llama `addToolResult()`:

| Tool | Office.js | Resultado |
|---|---|---|
| `read_excel_range` | `sheet.getRange(addr).load(["values",...])` | `{ address, values, rowCount, columnCount }` |
| `list_sheets` | `worksheets.load("name")` | `{ sheets: string[] }` |
| `navigate_to_cell` | `range.select()` | `{ success: true }` |
| `highlight_cells` | `range.format.fill.color = color` | `{ success: true }` |

### Con confirmación (tarjeta Aprobar/Cancelar)
`ChatMessageList.tsx` renderiza la tarjeta con preview. Al hacer clic, `onToolResult()` llama `addToolResult()`. Un `resolvedConfirmToolsRef` (Set) previene el loop de re-renderizado:

| Tool | Preview en la tarjeta |
|---|---|
| `write_excel_range` | Tabla con datos a escribir |
| `format_range` | Color de relleno, negrita, color fuente, formato número |
| `create_table` | Rango, hoja, ¿tiene encabezados? |
| `sort_range` | Columna de ordenación, dirección |
| `filter_range` | Columna filtrada, criterio |
| `create_chart` | Tipo de gráfico, rango de datos, título |

### Contexto Excel en el mensaje
`src/lib/assistant.ts` → `buildMessageWithExcelContext()` inyecta los datos de la hoja activa como bloque TSV al inicio del `message` antes de enviarlo al backend (máx. 100 filas), garantizando que el modelo los vea independientemente de cómo el backend procese `excelContext`.

### Suggested followups
Se leen de `message.annotations` (AI SDK v4 data annotations). El backend los envía como:
```typescript
dataStream.writeData({ type: "followups", suggestions: ["...", "..."] })
```
El componente `SuggestedFollowups.tsx` los muestra como botones pill debajo del último mensaje.

---

## Cómo cargar el add-in en Excel

### Desarrollo local (Excel de escritorio)
1. Correr `npm run dev` → task pane en `http://localhost:5173`
2. En Excel: Inicio → Complementos → Administrar mis complementos → Cargar → seleccionar `manifest.xml`

### Producción (Excel Online y escritorio)
1. Hacer build y desplegar en Vercel
2. Actualizar `manifest.vercel.xml` con tu dominio de Vercel
3. Cargar `manifest.vercel.xml` en Excel

> Excel Online no admite localhost — necesitas la URL de Vercel para probarlo en Excel Online.

---

## Reglas críticas — no las omitas

1. **Nunca llames directamente a GROQ, Cloudflare o cualquier modelo de IA desde el frontend.** Todo pasa por `VITE_BACKEND_URL`.

2. **Los PDFs se envían como base64 al backend en el mismo request del chat.** No los subas a ningún servicio externo desde el frontend. El backend los procesa en memoria y descarta.

3. **Límite de tamaño en el frontend antes de enviar:** Free = 5MB (1 archivo), Pro = 20MB (hasta 5 archivos). Muestra error claro si el archivo supera el límite.

4. **Nunca guardes API keys de usuarios en localStorage de forma persistente.** Se usan en el momento y se descartan.

5. **El contexto de Excel se manda completo al backend** (además de inyectarse en el mensaje como TSV). El backend trunca según el tier — no trunces en el frontend.

6. **Siempre incluir el JWT de Supabase en cada request al backend.** Usar `supabase.auth.getSession()` en `src/lib/api.ts`.

7. **No construyas componentes de chat desde cero cuando existen** — usa los componentes existentes en `src/components/chat/`. El sistema de tool calls ya está implementado; solo agrega nuevas tools siguiendo el patrón existente en `toolCalls.ts`, `useExcelTools.ts` y `ChatMessageList.tsx`.

8. **El historial de chat vive solo en memoria del cliente (estado de React).** No hay endpoint de historial. Al cerrar Excel o el add-in, el historial se descarta. Esto es por diseño — privacidad del usuario.

9. **Para evitar el loop de tarjetas de confirmación**, usar `addToolResult()` directamente (no `reload()`). El `resolvedConfirmToolsRef` en `ChatPage.tsx` rastreo los toolCallIds ya resueltos.

---

## Despliegue en Vercel

1. Conectar este repo en Vercel (repo público)
2. Framework preset: **Vite**
3. Agregar variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_BACKEND_URL=https://axel-addin-backend.vercel.app/api`
   - `VITE_UPGRADE_URL` _(opcional)_
4. Desplegar
5. Actualizar `manifest.vercel.xml` con la URL generada por Vercel
6. Cargar el manifest en Excel

> El backend ya está desplegado y funcionando. No necesitas configurarlo.
> El frontend también está desplegado en https://axel-black.vercel.app

---

## Lo que NO debes hacer

- ❌ No llames a modelos de IA directamente desde el frontend
- ❌ No implementes autenticación propia — usa Supabase Auth + Office Dialog API
- ❌ No construyas la UI de chat desde cero — extiende los componentes existentes
- ❌ No uses CSS modules ni styled-components — solo Tailwind v4
- ❌ No subas archivos .env al repo
- ❌ No pongas lógica de negocio (rate limiting, tiers, billing) en el frontend
- ❌ No almacenes ni envíes historial de chat al backend — solo en memoria del cliente
- ❌ No almacenes PDFs en el cliente más allá del request actual
- ❌ No uses `reload()` para enviar tool results — usa `addToolResult()` de `useChat`

---

## Recursos

- [Vercel AI SDK — useChat](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot)
- [Vercel AI SDK — Tool Calls](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#tool-calling)
- [Office.js Excel API](https://learn.microsoft.com/en-us/javascript/api/excel)
- [Supabase Auth docs](https://supabase.com/docs/guides/auth)
- [Office Dialog API](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/dialog-api-in-office-add-ins)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
