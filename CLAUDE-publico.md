# CLAUDE.md — Axel Add-in (repo público)

Este es el repo **público**. Contiene el add-in de Excel — lo que el usuario ve e instala.
Toda la lógica de auth, billing, modelos de IA y rate limiting vive en el **backend privado ya desplegado**.

**Backend en producción:** `https://axel-addin-backend.vercel.app/api`

Lee `ARCHITECTURE.md` para entender el sistema completo antes de tocar código.

---

## Qué hace este repo

- Renderiza el task pane dentro de Microsoft Excel (Office Add-in)
- Muestra la UI de chat con streaming usando assistant-ui
- Autentica al usuario con Clerk (Google / email)
- Lee el contexto de Excel (rango seleccionado, hoja activa) via Office.js
- Permite adjuntar PDFs e imágenes al chat (se envían como base64 al backend)
- Envía requests al backend privado — nunca directamente a GROQ ni Cloudflare
- Muestra el contador de tokens y pantalla de upgrade
- El historial de chat es solo en sesión (en memoria del cliente) — no se persiste

---

## Relación con el backend privado

| Este repo (add-in) | Backend privado |
|---|---|
| `github.com/sistsalcedo/Axel` | `github.com/mscnegocio-del/Axel-addin-backend` (privado) |
| Corre dentro de Excel (task pane) | Corre en Vercel Node.js Functions |
| Solo UI + Office.js | Auth, billing, IA, rate limiting |

**Este repo NO contiene lógica de negocio. Solo consume endpoints del backend.**

### Endpoints que consume
```
POST https://axel-addin-backend.vercel.app/api/chat   → envía mensaje + contexto Excel + adjuntos
GET  https://axel-addin-backend.vercel.app/api/usage  → obtiene tokens usados este mes
```

Todos los requests incluyen el JWT de Clerk:
```
Authorization: Bearer <clerk_jwt>
```

---

## Estructura de carpetas

```
/
├── src/
│   ├── components/
│   │   ├── chat/               # Componentes de assistant-ui customizados
│   │   ├── auth/               # Pantallas de login/registro (Clerk)
│   │   ├── billing/            # Contador de tokens, pantalla de upgrade
│   │   ├── excel/              # Botones de acción sobre el libro
│   │   └── attachments/        # Upload de PDFs e imágenes, preview
│   ├── hooks/
│   │   ├── useExcelContext.ts   # Lee rango seleccionado via Office.js
│   │   ├── useTokenUsage.ts     # Consulta tokens usados del mes
│   │   ├── useModelSelector.ts  # Estado del modelo seleccionado
│   │   └── useFileAttachment.ts # Manejo de PDFs e imágenes adjuntas
│   ├── lib/
│   │   ├── assistant.ts         # Configuración del runtime de assistant-ui
│   │   └── clerk.ts             # Configuración de Clerk
│   ├── pages/
│   │   ├── ChatPage.tsx         # Página principal del task pane
│   │   ├── LoginPage.tsx        # Primera pantalla si no está autenticado
│   │   └── UpgradePage.tsx      # Pantalla cuando se agota el límite
│   └── main.tsx
├── manifest.xml                 # Manifest para desarrollo local
├── manifest.vercel.xml          # Manifest para producción
├── CLAUDE.md                    # Este archivo
├── ARCHITECTURE.md              # Arquitectura del sistema completo
├── index.html
├── vite.config.ts
└── package.json
```

---

## Stack — no cambies esto sin justificación

- **React 18 + TypeScript** — sin excepciones
- **Vite** — bundler, genera static files para el task pane
- **assistant-ui** (`@assistant-ui/react`) — toda la UI de chat, NO construyas componentes de chat desde cero
- **Tailwind CSS v4** — utility classes únicamente
- **shadcn/ui** — componentes base
- **Clerk** (`@clerk/clerk-react`) — autenticación, NO implementes auth propio
- **Vercel AI SDK** (`ai`) — conecta assistant-ui con el backend via streaming
- **Office.js** (`@types/office-js`) — interacción con Excel

---

## Variables de entorno

```
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_BACKEND_URL=https://axel-addin-backend.vercel.app/api
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

## Cómo cargar el add-in en Excel

### Desarrollo local (Excel de escritorio)
1. Correr `npm run dev` → task pane en `http://localhost:5173`
2. En Excel: Inicio → Complementos → Administrar mis complementos → Cargar → seleccionar `manifest.xml`

### Producción (Excel Online y escritorio)
1. Hacer build y desplegar en Vercel
2. Reemplazar URL en `manifest.vercel.xml` con tu dominio de Vercel
3. Cargar `manifest.vercel.xml` en Excel

> Excel Online no admite localhost — necesitas la URL de Vercel para probarlo en Excel Online.

---

## Reglas críticas — no las omitas

1. **Nunca llames directamente a GROQ, Cloudflare o cualquier modelo de IA desde el frontend.** Todo pasa por `VITE_BACKEND_URL`.

2. **Los PDFs se envían como base64 al backend en el mismo request del chat.** No los subas a ningún servicio externo desde el frontend. El backend los procesa en memoria y descarta.

3. **Límite de tamaño en el frontend antes de enviar:** Free = 5MB (1 archivo), Pro = 20MB (hasta 5 archivos). Muestra error claro si el archivo supera el límite.

4. **Nunca guardes API keys de usuarios en localStorage de forma persistente.** Se usan en el momento y se descartan.

5. **El contexto de Excel se manda completo al backend.** El backend trunca según el tier — no trunces en el frontend.

6. **Siempre incluir el JWT de Clerk en cada request al backend.** Usar el hook `useAuth()` de Clerk para obtenerlo.

7. **No construyas componentes de chat desde cero** — streaming, auto-scroll, estados de carga, tool calls visibles — todo está en assistant-ui.

8. **El historial de chat vive solo en memoria del cliente (estado de React).** No hay endpoint de historial. Al cerrar Excel o el add-in, el historial se descarta. Esto es por diseño — privacidad del usuario.

---

## Despliegue en Vercel

1. Conectar este repo en Vercel (repo público)
2. Framework preset: **Vite**
3. Agregar variables de entorno:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_BACKEND_URL=https://axel-addin-backend.vercel.app/api`
4. Desplegar
5. Actualizar `manifest.vercel.xml` con la URL generada por Vercel
6. Cargar el manifest en Excel

> El backend ya está desplegado y funcionando. No necesitas configurarlo.

---

## Lo que NO debes hacer

- ❌ No llames a modelos de IA directamente desde el frontend
- ❌ No implementes autenticación propia — usa Clerk
- ❌ No construyas la UI de chat desde cero — usa assistant-ui
- ❌ No uses CSS modules ni styled-components — solo Tailwind v4
- ❌ No subas archivos .env al repo
- ❌ No pongas lógica de negocio (rate limiting, tiers, billing) en el frontend
- ❌ No almacenes ni envíes historial de chat al backend — solo en memoria del cliente
- ❌ No almacenes PDFs en el cliente más allá del request actual

---

## Recursos

- [assistant-ui docs](https://www.assistant-ui.com/docs)
- [Clerk React docs](https://clerk.com/docs/references/react)
- [Office.js Excel API](https://learn.microsoft.com/en-us/javascript/api/excel)
- [Vercel AI SDK — useChat](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
