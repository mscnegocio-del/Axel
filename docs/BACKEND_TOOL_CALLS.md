# Tool calls: coordinación frontend ↔ backend

El add-in está preparado para **mostrar tool calls** en el chat (tarjetas "Leyendo rango…", "Escribir datos" con Aprobar/Cancelar). Para que funcionen de punta a punta, el **backend** debe devolver y aceptar el formato descrito aquí.

## Estado actual

- **Frontend:** Renderiza `message.toolInvocations` cuando existen. Muestra tarjetas para:
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

Cuando el usuario **no** ha aprobado/cancelado una tool, el add-in envía:

```json
{ "message": "...", "excelContext": { ... }, "attachment": { ... } }
```

Cuando el usuario aprueba o cancela una tool, el add-in hace **reload** y envía el mismo body anterior más **toolCalls** y **toolResults**, para que el backend reconstruya el turno del asistente en el array de mensajes:

```json
{
  "message": "<último mensaje del usuario que provocó la respuesta con tools>",
  "excelContext": { ... },
  "attachment": null,
  "toolCalls": [
    { "id": "<toolCallId>", "name": "<toolName>", "arguments": { ... } }
  ],
  "toolResults": [
    { "toolCallId": "<id>", "toolName": "<name>", "result": { "success": true } }
  ]
}
```

- **toolCalls:** todos los tool calls del último mensaje del asistente (`id` = `toolCallId`, `name` = `toolName`, `arguments` = `args`).
- **toolResults:** solo las invocaciones con `state === 'result'` (`toolCallId`, `toolName`, `result`). El `result` puede ser `{ success: true }`, `{ success: false, error: "..." }` o `{ cancelled: true }`.

El backend debe aceptar este body y, cuando existan `toolCalls` y `toolResults`, reconstruir el turno del asistente (mensaje con tool calls + results) antes de continuar el flujo del modelo.

## Resumen

| Componente | Acción |
|------------|--------|
| **Frontend** | Muestra tarjetas de tool calls cuando `message.toolInvocations` existe; ejecuta escritura en Excel al Aprobar. |
| **Backend** | Emitir tool calls en el stream (`tool_call` con `toolCallId`, `toolName`, `args`) y aceptar tool results para continuar la conversación. |

Cuando el backend implemente este flujo, las tarjetas serán visibles y el flujo Aprobar/Cancelar quedará cerrado con el modelo.
