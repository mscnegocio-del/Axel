# Tool calls: coordinación frontend ↔ backend

El add-in está preparado para **mostrar y ejecutar tool calls** iniciadas por el backend. Para que funcionen de punta a punta, el backend debe devolver y aceptar el formato descrito aquí.

---

## Estado actual del frontend

El frontend usa `useChat` de `ai/react` (AI SDK v4) con `maxSteps: 5` y `addToolResult`. Hay dos categorías de tools:

### Auto-execute (sin interacción del usuario)
El `useEffect` en `ChatPage.tsx` detecta `state: "call"` y ejecuta Office.js automáticamente:

| Tool | Args | Resultado devuelto |
|---|---|---|
| `read_excel_range` | `{ range: string }` | `{ address, values, rowCount, columnCount }` |
| `list_sheets` | `{}` | `{ sheets: string[] }` |
| `navigate_to_cell` | `{ range: string, sheetName?: string }` | `{ success: true }` |
| `highlight_cells` | `{ range: string, sheetName?: string, color?: string }` | `{ success: true }` |

### Con confirmación (tarjeta Aprobar/Cancelar)
`ChatMessageList.tsx` renderiza la tarjeta. El usuario aprueba o cancela, y el frontend llama `addToolResult()`:

| Tool | Args | Resultado si aprueba | Resultado si cancela |
|---|---|---|---|
| `write_excel_range` | `{ range, sheetName, data: unknown[][] }` | `{ success: true }` o `{ success: false, error }` | `{ cancelled: true }` |
| `format_range` | `{ range, sheetName?, fillColor?, bold?, fontColor?, numberFormat? }` | `{ success: true }` | `{ cancelled: true }` |
| `create_table` | `{ range, sheetName?, hasHeaders?, tableName? }` | `{ success: true }` | `{ cancelled: true }` |
| `sort_range` | `{ range, sheetName?, columnIndex?, ascending? }` | `{ success: true }` | `{ cancelled: true }` |
| `filter_range` | `{ range, sheetName?, columnIndex?, criterion? }` | `{ success: true }` | `{ cancelled: true }` |
| `create_chart` | `{ range, sheetName?, chartType?, title? }` | `{ success: true }` | `{ cancelled: true }` |

---

## Formato esperado del stream (backend → frontend)

El cliente usa **Vercel AI SDK v4** (`useChat` de `ai/react`). El stream debe ser compatible con `toDataStreamResponse()` y el header `x-vercel-ai-ui-message-stream: v1`.

El backend debe emitir tool calls con:
- `toolCallId` — string único
- `toolName` — uno de los nombres listados arriba
- `args` — objeto JSON según el tool

---

## Envío de tool results (cliente → backend)

El frontend usa `addToolResult({ toolCallId, result })`. El AI SDK v4 se encarga de:

1. Actualizar el estado local: `toolInvocations[i].state = "result"`
2. Enviar automáticamente al backend la siguiente request con los tool results incluidos

El backend solo necesita **aceptar tool results** en el formato estándar del AI SDK v4 y continuar el flujo de la conversación.

---

## Contexto Excel en el mensaje

Además del campo `excelContext` en el body, el frontend inyecta los datos de la hoja activa como bloque TSV directamente en el campo `message`:

```
[Excel — Hoja: Ventas, Rango: Ventas!A1:D11]
Producto	Precio	Cantidad	Total
Producto 1	10.99	2	21.98
Producto 2	5.99	3	17.97
...

<pregunta del usuario>
```

Máximo 100 filas. Esto garantiza que el modelo vea los datos aunque el backend no procese `excelContext.values` en el system prompt.

**Recomendación para el backend:** incluir `excelContext.values` explícitamente en el system message del modelo. Ejemplo:

```typescript
const systemMessage = `
Eres Axel, un asistente de IA especializado en analizar y manipular datos en Microsoft Excel.
El usuario trabaja en la hoja "${excelContext.sheetName}" (rango: ${excelContext.address}).

Cuando el usuario pregunta sobre los datos de la hoja, usa los datos del campo message (bloque [Excel — ...])
o llama a read_excel_range para obtener datos de un rango específico.
`;
```

---

## Suggested followups

El frontend ya está preparado para mostrar preguntas sugeridas al final de cada respuesta. Para activarlas, el backend debe enviar:

```typescript
// En src/routes/chat.ts (backend privado)
dataStream.writeData({ type: "followups", suggestions: [
  "¿Cuál es el producto con mayor total?",
  "Calcula el total general de todas las ventas",
  "Crea un gráfico de ventas por producto"
]});
```

El componente `SuggestedFollowups.tsx` los detecta en `message.annotations` y los muestra como botones pill. Al hacer clic, se envían como nuevo mensaje del usuario.

---

## Resumen

| Componente | Acción |
|---|---|
| **Frontend** | Renderiza tarjetas de tool calls; ejecuta Office.js (auto o con confirmación); envía tool results via `addToolResult()`. |
| **Backend** | Emite tool calls en el stream (`toDataStreamResponse`); acepta tool results para continuar la conversación; puede enviar `suggested_followups` como data annotation. |
