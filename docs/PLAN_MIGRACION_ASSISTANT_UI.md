# Plan: Migrar el chat a assistant-ui

Objetivo: sustituir `useChat` + componentes propios por el runtime y la UI de **assistant-ui** (`@assistant-ui/react`), manteniendo el contrato actual con el backend (POST /api/chat con body custom y stream Vercel AI SDK).

---

## Resultado del intento Opción A (reporte)

**Fecha:** Tras instalar `@assistant-ui/react-ai-sdk` y intentar usar `useAISDKRuntime(chat)` con el `useChat` actual del proyecto:

**Incompatibilidad:** `useAISDKRuntime` **no es compatible** con el `useChat` que devuelve el paquete **`ai` 3.x** (Vercel AI SDK v3).

- **Motivo:** `@assistant-ui/react-ai-sdk` está construido para **AI SDK v6** y espera el tipo de retorno de `useChat` de `@ai-sdk/react` v3 / `ai` v6. Ese API incluye, entre otros: `id`, `sendMessage`, `regenerate`, `addToolOutput`/`addToolResult`, y un formato de mensajes con `parts` (no solo `content` + `toolInvocations`).
- En este proyecto, `useChat` (desde `ai/react` 3.x) devuelve: `handleSubmit`, `append`, `reload`, `setMessages`, `messages`, `input`, `handleInputChange`, `isLoading`, `error` — sin `id`, `sendMessage`, `regenerate` ni `addToolOutput`. El tipo no coincide y TypeScript lo rechaza (p. ej. falta la propiedad `id` requerida).
- **Conclusión:** No se puede usar Opción A sin **actualizar a `ai` v6 y `@ai-sdk/react` v3**, lo que puede implicar cambios en el backend (formato de stream/mensajes) y en el body (si v6 usa otro contrato). No se ha implementado Opción B; queda pendiente de confirmación.

---

## Contexto

- **CLAUDE-publico.md** exige usar assistant-ui para la UI de chat y no construir desde cero.
- Hoy: `useChat` (ai/react) + `ChatMessageList` + formulario propio. Backend recibe `message`, `excelContext`, `attachment`, y opcionalmente `toolCalls`/`toolResults`.
- Hay que conservar: useExcelContext, useFileAttachment, useTokenUsage, tarjetas de tool calls (ReadRangeCard, WriteRangeCard), manejo de 429 → UpgradePage, historial solo en memoria.

---

## Opciones de runtime

### Opción A: Integración AI SDK + `useChat` actual (recomendada como primer paso)

- **Idea:** Añadir `@assistant-ui/react-ai-sdk` y usar **useAISDKRuntime(chat)** (doc: “For advanced use cases where you need direct access to the useChat hook”). Se sigue usando nuestro `useChat` con `experimental_prepareRequestBody`, `chatFetch`, `body` (excelContext, attachment) y la lógica de toolCalls/toolResults en reload.
- **Ventaja:** Mínimo cambio en lógica; solo se cambia la capa de presentación (Thread, Composer, etc.).
- **Pasos:**
  1. Instalar `@assistant-ui/react-ai-sdk` (y comprobar compatibilidad con `ai@3.x` y `@ai-sdk/react` que use el paquete).
  2. En `ChatPage`, crear el runtime con `useAISDKRuntime(chat)` pasando el objeto devuelto por `useChat` (con nuestro fetch, body y prepareRequestBody).
  3. Envolver el contenido del chat en `AssistantRuntimeProvider` y sustituir `ChatMessageList` + formulario por `<Thread />` (o la estructura recomendada: Thread + ThreadMessages + Composer).
  4. Registrar las tools `read_excel_range` y `write_excel_range` en la UI de assistant-ui (si el paquete expone API tipo `makeAssistantToolUI` o similar) para seguir mostrando ReadRangeCard y WriteRangeCard, y conectar Aprobar/Cancelar a la ejecución en Excel y al envío de tool results (reload con toolCalls/toolResults).
  5. Mantener header (TokenUsageDisplay, UserButton), bloque de excelContext, AttachmentList y manejo de error/429 fuera del Thread pero en la misma página.
- **Riesgo:** Que `useAISDKRuntime` espere una API exacta de `useChat` (p. ej. v6) y nuestro `ai@3`/custom body no sea compatible; en ese caso pasar a Opción B.

### Opción B: ExternalStoreRuntime (control total del estado y del request)

- **Idea:** No usar useChat. Estado de mensajes en React (por ejemplo mismo tipo `Message[]` o uno propio), y **useExternalStoreRuntime** con:
  - **convertMessage:** de nuestro formato de mensaje (incl. `toolInvocations`) a `ThreadMessageLike` (content con partes `text` y `tool-call` / tool result según corresponda).
  - **onNew:** POST al backend con `prepareChatBody({ message, excelContext, attachment })`, consumir el stream (p. ej. `readDataStream` / `processChatStream` de `ai` o del SDK), ir actualizando el último mensaje asistente (texto + tool invocations) según lleguen partes.
  - **onReload:** Si el último mensaje es del asistente y tiene al menos un tool con `state === 'result'`, POST con `prepareChatBody({ message, excelContext, attachment, toolCalls, toolResults })` (reutilizando `getToolCallsAndResultsFromMessage`); si no, mismo flujo que onNew. Consumir stream y actualizar mensajes.
  - **setMessages:** para que assistant-ui pueda hacer branch switching si se usa.
  - **onCancel:** abortar el fetch en curso (AbortController) y poner `isRunning = false`.
- **Ventaja:** Encaje directo con nuestro body y con toolCalls/toolResults; no dependemos de la integración AI SDK.
- **Desventaja:** Hay que implementar el consumo del stream y la actualización progresiva de mensajes (y de tool invocations) a mano.
- **Pasos:**
  1. Crear un provider (p. ej. `AxelRuntimeProvider`) que tenga estado `messages`, `isRunning`, y opcionalmente `abortControllerRef`.
  2. Implementar `convertMessage` de nuestro tipo de mensaje a `ThreadMessageLike` (incluyendo partes de tipo `tool-call` y el estado/resultado de tools).
  3. Implementar `onNew`: añadir mensaje usuario, POST con prepareChatBody (sin toolCalls/toolResults), leer stream y actualizar el mensaje asistente (texto y toolInvocations).
  4. Implementar `onReload`: decidir si es “reload con tool results” (último mensaje asistente con results) o “reload normal”; en el primer caso incluir toolCalls y toolResults en el body; luego mismo consumo de stream.
  5. Sustituir ChatPage: usar `AssistantRuntimeProvider` con ese runtime, `<Thread />` (o Thread + ThreadMessages + Composer), y registrar las tool UIs para ReadRangeCard y WriteRangeCard.
  6. Mantener header, excelContext, AttachmentList, 429 y token usage como hasta ahora.

---

## Recomendación

- **Fase 1:** Probar **Opción A** (useAISDKRuntime con el useChat actual). Si la integración acepta nuestro body y nuestro flujo de tool results, es el camino más corto y se mantiene toda la lógica actual.
- **Fase 2 (solo si A falla o es inviable):** Implementar **Opción B** con ExternalStoreRuntime y consumo propio del stream.

---

## Tareas comunes (independientes de A o B)

1. **UI de assistant-ui**
   - Reemplazar `ChatMessageList` por la estructura que marque la doc (p. ej. `<Thread />` que incluye mensajes + composer, o `Thread` + `ThreadMessages` + `Composer`).
   - Eliminar el formulario custom; usar el Composer de assistant-ui (posiblemente con slot o wrapper para añadir el input de adjuntos junto al Composer).

2. **Adjuntos (useFileAttachment)**
   - Siguen formando parte del body en cada POST (excelContext + attachment). En A: el `body` de useChat ya los incluye. En B: pasarlos en prepareChatBody dentro de onNew/onReload (leyendo desde el contexto/hook actual).
   - Decidir dónde se muestra el AttachmentList: arriba del Composer o integrado en el Composer (según capacidades de assistant-ui para “attachments” en el composer).

3. **Contexto Excel (useExcelContext)**
   - Sin cambios: se lee en ChatPage y se envía en el body. En A: ya está en `body.excelContext`. En B: inyectarlo en prepareChatBody en cada onNew/onReload.
   - El texto “Hoja: … · Rango: …” puede quedar como está, fuera del Thread.

4. **Tool calls (ReadRangeCard, WriteRangeCard)**
   - Assistant-ui usa partes de contenido tipo `tool-call` (y posiblemente estado/result). Hay que:
     - En A: si useChat ya rellena `message.toolInvocations`, ver cómo los expone el runtime y registrar tool UIs para `read_excel_range` y `write_excel_range` que rendericen nuestras tarjetas y llamen a executeWrite + enviar result (reload) al Aprobar.
     - En B: en convertMessage (o en el contenido del mensaje asistente) mapear nuestras toolInvocations a partes `tool-call` (y resultado) y registrar las mismas tool UIs.
   - Aprobar: ejecutar useExcelWrite, marcar resultado en el mensaje y disparar reload (A: reload de useChat; B: onReload con body que incluye toolCalls/toolResults).

5. **429 y upgrade**
   - Mantener `onResponse` / manejo de error que detecta 429 y llama `onLimitExceeded()`. En A: sigue en useChat. En B: en el fetch de onNew/onReload, comprobar `response.status === 429` y llamar onLimitExceeded antes de parsear el body.

6. **Token usage (useTokenUsage)**
   - Sin cambios: TokenUsageDisplay en el header y `tokenUsageRefetch()` en onFinish (A) o al terminar el stream en onNew/onReload (B).

7. **Historial en memoria**
   - En A: useChat ya mantiene mensajes en estado React; no hay persistencia. En B: el estado `messages` del provider es solo en memoria; no persistir a backend ni localStorage.

---

## Orden sugerido de implementación (cuando se escriba código)

1. Instalar y comprobar versión de `@assistant-ui/react-ai-sdk` (y compatibilidad con `ai` / `@ai-sdk/react`).
2. Probar Opción A: useAISDKRuntime(useChat(...)) en una rama, con Thread + Composer y sin tool UI primero.
3. Si el body (excelContext, attachment, toolCalls, toolResults) se envía correctamente y el stream se muestra bien, añadir registro de tool UIs y conectar ReadRangeCard/WriteRangeCard y flujo Aprobar → reload.
4. Si A no es viable, implementar Opción B (ExternalStoreRuntime + consumo del stream) y luego las mismas piezas de UI y tools.
5. Ajustar AttachmentList y mensaje de excelContext para que convivan con el Composer.
6. Verificar 429, token usage, onFinish y que el historial sigue solo en memoria.

---

## Referencias

- CLAUDE-publico.md (stack, “no construir UI desde cero”).
- ARCHITECTURE.md (flujo chat, backend, sin persistencia de historial).
- [assistant-ui: Picking a Runtime](https://www.assistant-ui.com/docs/runtimes/pick-a-runtime).
- [assistant-ui: ExternalStoreRuntime](https://www.assistant-ui.com/docs/runtimes/custom/external-store).
- [assistant-ui: AI SDK v6](https://www.assistant-ui.com/docs/runtimes/ai-sdk/v6) (useChatRuntime, useAISDKRuntime).
- [assistant-ui: Message parts (tool-call)](https://www.assistant-ui.com/docs/api-reference/primitives/message-part).
