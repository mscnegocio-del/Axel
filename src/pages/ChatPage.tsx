import { useState, useCallback, useEffect, useRef } from "react";
import { useChat, type Message } from "ai/react";
import type { JSONValue } from "ai";
import {
  chatFetch,
  getChatApiUrl,
  prepareChatBody,
  getToolCallsAndResultsFromMessage,
  type AttachmentPayload,
} from "@/lib/assistant";
import { TokenUsageDisplay } from "@/components/billing/TokenUsageDisplay";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { AttachmentList } from "@/components/attachments/AttachmentList";
import { useExcelContext } from "@/hooks/useExcelContext";
import { useExcelWrite } from "@/hooks/useExcelWrite";
import { supabase } from "@/lib/supabase";
import { useFileAttachment, type Tier } from "@/hooks/useFileAttachment";
import { TOOL_READ_EXCEL_RANGE, parseReadRangeArgs } from "@/lib/toolCalls";

type ChatPageProps = {
  tier: Tier;
  tokensUsed: number;
  tokensLimit: number;
  tokensLoading: boolean;
  onLimitExceeded: () => void;
  tokenUsageRefetch: () => Promise<void>;
};

const UPGRADE_URL = import.meta.env.VITE_UPGRADE_URL ?? "https://axeldemo.lemonsqueezy.com/checkout";

function getMessageContent(msg: Message): string {
  return typeof msg.content === "string" ? msg.content : String(msg.content ?? "");
}

/**
 * En useChat, experimental_prepareRequestBody REEMPLAZA por completo el body del request.
 * El SDK solo envía lo que devolvemos aquí; el array "messages" del historial local
 * NO se envía al backend — solo message + excelContext + attachment.
 */
export default function ChatPage({
  tier,
  tokensUsed,
  tokensLimit,
  tokensLoading,
  onLimitExceeded,
  tokenUsageRefetch,
}: ChatPageProps) {
  const { excelContext, getContextForMessage } = useExcelContext();

  // Ref con el contexto que se incluirá en el próximo request.
  // Se actualiza por dos vías:
  //   1. useEffect a continuación — cada vez que los listeners del hook actualizan el estado.
  //   2. onFormSubmit — justo antes de cada envío manual, lee Excel en vivo.
  const pendingContextRef = useRef(excelContext);

  useEffect(() => {
    pendingContextRef.current = excelContext;
  }, [excelContext]);
  const attachmentState = useFileAttachment(tier);
  const executeWrite = useExcelWrite();
  const [executingToolCallId, setExecutingToolCallId] = useState<string | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    addToolResult,
  } = useChat({
    api: getChatApiUrl(),
    fetch: chatFetch,
    maxSteps: 5,
    body: {
      attachment: attachmentState.getAttachmentForRequest(),
    },
    experimental_prepareRequestBody: ({ messages: msgs, requestBody }) => {
      const extra = (requestBody ?? {}) as {
        attachment?: AttachmentPayload | null;
      };
      // pendingContextRef.current siempre tiene el contexto más reciente:
      // actualizado por listeners (onActivated/onChanged) y por onFormSubmit justo antes del envío.
      const ctx = pendingContextRef.current;

      const last = msgs[msgs.length - 1];
      const hasAssistantToolResults =
        last?.role === "assistant" &&
        Array.isArray((last as Message).toolInvocations) &&
        (last as Message).toolInvocations?.some(
          (inv: { state?: string }) => inv.state === "result"
        );

      let message: string;
      let toolCalls: { id: string; name: string; arguments: unknown }[] | undefined;
      let toolResults: { toolCallId: string; toolName: string; result: unknown }[] | undefined;

      if (hasAssistantToolResults && msgs.length >= 2) {
        const userMsg = msgs[msgs.length - 2];
        message = getMessageContent(userMsg);
        const { toolCalls: tc, toolResults: tr } = getToolCallsAndResultsFromMessage(last as Message);
        if (tc.length) toolCalls = tc;
        if (tr.length) toolResults = tr;
      } else {
        message = last ? getMessageContent(last) : "";
      }

      return prepareChatBody({
        message,
        excelContext: ctx,
        attachment: extra.attachment ?? undefined,
        toolCalls,
        toolResults,
      }) as JSONValue;
    },
    onResponse: async (res) => {
      if (res.status !== 429) return;

      try {
        const cloned = res.clone();
        const data = (await cloned.json().catch(() => null)) as
          | { message?: string; code?: string }
          | null;

        const message = typeof data?.message === "string" ? data.message : "";
        const code = typeof data?.code === "string" ? data.code : "";

        // Reset mensaje previo
        setRateLimitMessage(null);

        if (code === "TOKEN_LIMIT_EXCEEDED") {
          onLimitExceeded();
          return;
        }

        const lower = message.toLowerCase();

        if (lower.includes("cooldown")) {
          setRateLimitMessage("Espera unos segundos antes de enviar otro mensaje.");
          return;
        }

        if (lower.includes("hourly") || lower.includes("rate limit")) {
          setRateLimitMessage(
            "Has enviado demasiados mensajes. Intenta de nuevo en unos minutos."
          );
          return;
        }

        // Fallback genérico para otros 429 sin upgrade
        setRateLimitMessage("Demasiadas solicitudes. Intenta más tarde.");
      } catch {
        // Si algo falla al leer el body, no mostramos upgrade ni mensaje específico
      }
    },
    // Tras cada envío exitoso: limpiar adjuntos y refrescar contador de tokens.
    onFinish: () => {
      attachmentState.clear();
      void tokenUsageRefetch();
      setRateLimitMessage(null);
    },
    onError: () => {
      // Los 429 se manejan en onResponse con lógica más fina.
    },
  });

  const onToolResult = useCallback(
    (_messageId: string, toolCallId: string, result: unknown) => {
      addToolResult({ toolCallId, result });
    },
    [addToolResult]
  );

  // IDs de read_excel_range ya procesados (evita doble ejecución por re-renders).
  const executedReadToolsRef = useRef(new Set<string>());

  /**
   * Cuando el backend dispara read_excel_range, el frontend debe leer el rango
   * de Excel automáticamente y devolver los datos via addToolResult.
   * Sin esto, el backend espera el result indefinidamente y la conversación se cuelga.
   */
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      const invocations = msg.toolInvocations;
      if (!Array.isArray(invocations)) continue;

      for (const inv of invocations) {
        if (inv.state !== "call" || inv.toolName !== TOOL_READ_EXCEL_RANGE) continue;

        const { toolCallId } = inv;
        if (executedReadToolsRef.current.has(toolCallId)) continue;
        executedReadToolsRef.current.add(toolCallId);

        const { range } = parseReadRangeArgs(inv.args);

        if (!range) {
          addToolResult({ toolCallId, result: { error: "No se especificó un rango." } });
          continue;
        }

        if (typeof Excel === "undefined") {
          addToolResult({ toolCallId, result: { error: "Excel no disponible." } });
          continue;
        }

        // El rango puede venir como "Hoja1!A1:D10" o simplemente "A1:D10".
        let sheetId: string | undefined;
        let rangeAddr = range;
        if (range.includes("!")) {
          const idx = range.indexOf("!");
          sheetId = range.slice(0, idx).replace(/'/g, "");
          rangeAddr = range.slice(idx + 1);
        }

        void Excel.run(async (context) => {
          const sheet = sheetId
            ? context.workbook.worksheets.getItem(sheetId)
            : context.workbook.worksheets.getActiveWorksheet();
          const r = sheet.getRange(rangeAddr);
          r.load(["address", "values", "rowCount", "columnCount"]);
          await context.sync();
          addToolResult({
            toolCallId,
            result: {
              address: r.address,
              values: r.values,
              rowCount: r.rowCount,
              columnCount: r.columnCount,
            },
          });
        }).catch((e: unknown) => {
          addToolResult({
            toolCallId,
            result: { error: e instanceof Error ? e.message : String(e) },
          });
        });
      }
    }
  }, [messages, addToolResult]);

  /**
   * Wrapper del submit del formulario:
   * 1. Llama a getContextForMessage() para leer Excel en vivo.
   * 2. Guarda el resultado en pendingContextRef antes de que prepareRequestBody lo lea.
   * 3. Llama a handleSubmit para disparar la request al backend.
   */
  const onFormSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      try {
        pendingContextRef.current = await getContextForMessage();
      } catch {
        // Si la lectura falla, pendingContextRef.current conserva el último contexto conocido.
      }
      handleSubmit(e);
    },
    [getContextForMessage, handleSubmit]
  );

  return (
    <div className="flex min-h-screen flex-col p-4">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Axel</h1>
          <TokenUsageDisplay
            tokensUsed={tokensUsed}
            limit={tokensLimit}
            isLoading={tokensLoading}
            onUpgradeClick={() => window.open(UPGRADE_URL, "_blank")}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            void supabase.auth.signOut();
          }}
          className="text-sm text-muted-foreground hover:underline"
        >
          Cerrar sesión
        </button>
      </header>
      <main className="flex flex-1 flex-col gap-3 overflow-hidden pt-4">
        {excelContext.range && (
          <p className="text-muted-foreground text-xs">
            Hoja: {excelContext.sheetName} · Rango: {excelContext.range}
          </p>
        )}
        <ChatMessageList
          messages={messages}
          isLoading={isLoading}
          emptyMessage="Escribe un mensaje. Se enviará el rango seleccionado en Excel como contexto."
          executeWrite={executeWrite}
          onToolResult={onToolResult}
          executingToolCallId={executingToolCallId}
          setExecutingToolCallId={setExecutingToolCallId}
        />
        <AttachmentList
          files={attachmentState.files.map((f) => ({ id: f.id, filename: f.filename }))}
          onRemove={attachmentState.removeFile}
          error={attachmentState.error}
        />
        {error && !rateLimitMessage && (
          <p className="text-destructive text-sm">{error.message}</p>
        )}
        {rateLimitMessage && (
          <p className="text-muted-foreground text-sm">{rateLimitMessage}</p>
        )}
        <form onSubmit={(e) => { void onFormSubmit(e); }} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => {
                const list = e.target.files;
                if (list) attachmentState.addFiles(list);
                e.target.value = "";
              }}
              className="text-muted-foreground text-xs file:mr-2 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:text-primary-foreground"
            />
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Mensaje..."
              className="border-input flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
