# Tool calls: coordinación frontend ↔ backend

El add-in está preparado para **mostrar tool calls** en el chat (tarjetas "Leyendo rango…", "Escribir datos" con Aprobar/Cancelar). Para que funcionen de punta a punta, el **backend** debe devolver y aceptar el formato descrito aquí.

## Estado actual

- **Frontend:** Usa `useChat` de `ai/react` (AI SDK v4) con tool calling. Renderiza `message.toolInvocations` cuando existen. Muestra tarjetas para:
  - `read_excel_range` → "Leyendo rango {range}..."
  - `write_excel_range` → preview de datos + botones Aprobar / Cancelar (ejecuta escritura via Office.js en el cliente).
- **Backend:** El add-in no puede inspeccionar el repo privado. Si hoy el stream de `POST /api/chat` solo devuelve texto (sin partes de tipo tool), las tarjetas no aparecerán hasta que el backend envíe tool calls.

## Formato esperado del stream (backend → frontend)

El cliente usa **Vercel AI SDK** (`useChat` de `ai/react`). El stream debe ser compatible con el protocolo que procesa `@ai-sdk/ui-utils` (p. ej. `processChatStream` / data protocol):

1. **Tool call:** el backend debe emitir partes de tipo `tool_call` con al menos:
   - `toolCallId` (string único)
   - `toolName` (`read_excel_range` | `write_excel_range` u otros que acordemos)
   - `args` (objeto JSON según el tool)

2. **Tool result:** cuando el cliente ejecuta una herramienta (p. ej. escribe en Excel) y envía el resultado, el backend debe poder recibir ese resultado y continuar el flujo (siguiente turno del modelo con el contexto del tool result).

Ejemplo de herramientas sugeridas:

- **read_excel_range**  
  - `args`: `{ range: string }` (ej. `"A1:D50"`).  
  - En el add-in se muestra la tarjeta "Leyendo rango A1:D50...". La lectura real la hace el backend (o el cliente ya envía el contexto en el mensaje); la tarjeta es informativa.

- **write_excel_range**  
  - `args`: `{ range: string, sheetName?: string, data: unknown[][] }`.  
  - En el add-in se muestra una tarjeta con preview y botones Aprobar / Cancelar. Al Aprobar, el cliente escribe en Excel con Office.js y puede enviar un **tool result** (éxito o error) al backend para que el modelo continúe.

## Envío de tool results (cliente → backend)

El frontend ya **no** construye manualmente `toolCalls` y `toolResults` en el body. En su lugar:

- Usa `maxSteps` > 1 en `useChat` y
- Llama a `addToolResult({ toolCallId, result })` cuando el usuario aprueba o cancela una tool.

El AI SDK v4 se encarga de:

1. Actualizar el último mensaje del asistente (`toolInvocations[*].state = "result"` y `result = {...}`).
2. Volver a llamar al backend con el formato de stream estándar (`toDataStreamResponse` / `x-vercel-ai-ui-message-stream: v1`), incluyendo automáticamente los tool calls y tool results.

El backend solo necesita:

- Emitir tool calls en el stream cuando el modelo las genera.
- Continuar el flujo de la conversación cuando recibe tool results del cliente (según el protocolo oficial de AI SDK v4).

## Resumen

| Componente | Acción |
|------------|--------|
| **Frontend** | Muestra tarjetas de tool calls cuando `message.toolInvocations` existe; ejecuta escritura en Excel al Aprobar. |
| **Backend** | Emitir tool calls en el stream (`tool_call` con `toolCallId`, `toolName`, `args`) y aceptar tool results para continuar la conversación. |

Cuando el backend implemente este flujo, las tarjetas serán visibles y el flujo Aprobar/Cancelar quedará cerrado con el modelo.
