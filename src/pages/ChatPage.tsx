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
import {
  useExcelFormat,
  useExcelCreateTable,
  useExcelSortRange,
  useExcelFilterRange,
  useExcelCreateChart,
  useExcelCreatePivotTable,
  useExcelEditPivotTable,
  useExcelConditionalFormat,
  useExcelDataValidation,
  useExcelEditChart,
} from "@/hooks/useExcelTools";
import { supabase } from "@/lib/supabase";
import { useFileAttachment, type Tier } from "@/hooks/useFileAttachment";
import {
  TOOL_READ_EXCEL_RANGE,
  TOOL_LIST_SHEETS,
  TOOL_NAVIGATE_TO_CELL,
  TOOL_HIGHLIGHT_CELLS,
  parseReadRangeArgs,
  parseNavigateToCellArgs,
  parseHighlightCellsArgs,
  parseFormatRangeArgs,
  parseCreateTableArgs,
  parseSortRangeArgs,
  parseFilterRangeArgs,
  parseCreateChartArgs,
  parseCreatePivotTableArgs,
  parseEditPivotTableArgs,
  parseConditionalFormatArgs,
  parseDataValidationArgs,
  parseEditChartArgs,
} from "@/lib/toolCalls";

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
  const pendingContextRef = useRef(excelContext);
  useEffect(() => {
    pendingContextRef.current = excelContext;
  }, [excelContext]);

  const attachmentState = useFileAttachment(tier);

  // ── Hooks de ejecución de tools ────────────────────────────────────────────
  const executeWrite = useExcelWrite();
  const executeFormat = useExcelFormat();
  const executeCreateTable = useExcelCreateTable();
  const executeSortRange = useExcelSortRange();
  const executeFilterRange = useExcelFilterRange();
  const executeCreateChart = useExcelCreateChart();
  const executeCreatePivotTable = useExcelCreatePivotTable();
  const executeEditPivotTable = useExcelEditPivotTable();
  const executeConditionalFormat = useExcelConditionalFormat();
  const executeDataValidation = useExcelDataValidation();
  const executeEditChart = useExcelEditChart();

  const [executingToolCallId, setExecutingToolCallId] = useState<string | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);

  // Set de toolCallIds de confirmación ya resueltos (aprobados o cancelados).
  // Se usa para suprimir los botones Aprobar/Cancelar inmediatamente tras el clic,
  // antes de que addToolResult haya actualizado el estado del mensaje.
  const resolvedConfirmToolsRef = useRef(new Set<string>());

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
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
          setRateLimitMessage("Has enviado demasiados mensajes. Intenta de nuevo en unos minutos.");
          return;
        }
        setRateLimitMessage("Demasiadas solicitudes. Intenta más tarde.");
      } catch {
        // No hacer nada si falla al leer el body
      }
    },
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
      // Registrar el ID antes de llamar a addToolResult para que el guard de
      // isResolved en ChatMessageList ya esté activo en el próximo re-render.
      resolvedConfirmToolsRef.current.add(toolCallId);
      addToolResult({ toolCallId, result });
    },
    [addToolResult]
  );

  // ── Auto-execute tools ─────────────────────────────────────────────────────
  // IDs ya procesados para evitar doble ejecución por re-renders.
  const executedAutoToolsRef = useRef(new Set<string>());

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      const invocations = msg.toolInvocations;
      if (!Array.isArray(invocations)) continue;

      for (const inv of invocations) {
        if (inv.state !== "call") continue;

        const { toolCallId, toolName } = inv as { toolCallId: string; toolName: string; args?: unknown };
        if (executedAutoToolsRef.current.has(toolCallId)) continue;

        // ── read_excel_range ────────────────────────────────────────────────
        if (toolName === TOOL_READ_EXCEL_RANGE) {
          executedAutoToolsRef.current.add(toolCallId);
          const { range } = parseReadRangeArgs(inv.args);

          if (!range) {
            addToolResult({ toolCallId, result: { error: "No se especificó un rango." } });
            continue;
          }
          if (typeof Excel === "undefined") {
            addToolResult({ toolCallId, result: { error: "Excel no disponible." } });
            continue;
          }

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

        // ── list_sheets ─────────────────────────────────────────────────────
        else if (toolName === TOOL_LIST_SHEETS) {
          executedAutoToolsRef.current.add(toolCallId);
          if (typeof Excel === "undefined") {
            addToolResult({ toolCallId, result: { error: "Excel no disponible." } });
            continue;
          }
          void Excel.run(async (context) => {
            const sheets = context.workbook.worksheets;
            sheets.load("name");
            await context.sync();
            addToolResult({
              toolCallId,
              result: { sheets: sheets.items.map((s) => s.name) },
            });
          }).catch((e: unknown) => {
            addToolResult({
              toolCallId,
              result: { error: e instanceof Error ? e.message : String(e) },
            });
          });
        }

        // ── navigate_to_cell ────────────────────────────────────────────────
        else if (toolName === TOOL_NAVIGATE_TO_CELL) {
          executedAutoToolsRef.current.add(toolCallId);
          const { range, sheetName } = parseNavigateToCellArgs(inv.args);

          if (!range) {
            addToolResult({ toolCallId, result: { error: "No se especificó un rango." } });
            continue;
          }
          if (typeof Excel === "undefined") {
            addToolResult({ toolCallId, result: { error: "Excel no disponible." } });
            continue;
          }

          void Excel.run(async (context) => {
            const sheet = sheetName
              ? context.workbook.worksheets.getItem(sheetName)
              : context.workbook.worksheets.getActiveWorksheet();
            const r = sheet.getRange(range.includes("!") ? range.slice(range.indexOf("!") + 1) : range);
            r.select();
            await context.sync();
            addToolResult({ toolCallId, result: { success: true } });
          }).catch((e: unknown) => {
            addToolResult({
              toolCallId,
              result: { error: e instanceof Error ? e.message : String(e) },
            });
          });
        }

        // ── highlight_cells ─────────────────────────────────────────────────
        else if (toolName === TOOL_HIGHLIGHT_CELLS) {
          executedAutoToolsRef.current.add(toolCallId);
          const { range, sheetName, color = "#FFFF00" } = parseHighlightCellsArgs(inv.args);

          if (!range) {
            addToolResult({ toolCallId, result: { error: "No se especificó un rango." } });
            continue;
          }
          if (typeof Excel === "undefined") {
            addToolResult({ toolCallId, result: { error: "Excel no disponible." } });
            continue;
          }

          void Excel.run(async (context) => {
            const sheet = sheetName
              ? context.workbook.worksheets.getItem(sheetName)
              : context.workbook.worksheets.getActiveWorksheet();
            const r = sheet.getRange(range.includes("!") ? range.slice(range.indexOf("!") + 1) : range);
            r.format.fill.color = color;
            await context.sync();
            addToolResult({ toolCallId, result: { success: true } });
          }).catch((e: unknown) => {
            addToolResult({
              toolCallId,
              result: { error: e instanceof Error ? e.message : String(e) },
            });
          });
        }
      }
    }
  }, [messages, addToolResult]);

  // ── onToolResult para tools de confirmación (format, table, sort, filter, chart)
  // Se mantienen en ChatMessageList via props; aquí solo necesitamos las funciones.
  // Los parsers convierten unknown → tipo concreto dentro de los callbacks de ChatMessageList.
  // Exponemos wrappers tipados para que ChatMessageList reciba ExecuteFn (args: unknown).
  const executeFormatTyped = useCallback(
    (args: unknown) => executeFormat(parseFormatRangeArgs(args)),
    [executeFormat]
  );
  const executeCreateTableTyped = useCallback(
    (args: unknown) => executeCreateTable(parseCreateTableArgs(args)),
    [executeCreateTable]
  );
  const executeSortRangeTyped = useCallback(
    (args: unknown) => executeSortRange(parseSortRangeArgs(args)),
    [executeSortRange]
  );
  const executeFilterRangeTyped = useCallback(
    (args: unknown) => executeFilterRange(parseFilterRangeArgs(args)),
    [executeFilterRange]
  );
  const executeCreateChartTyped = useCallback(
    (args: unknown) => executeCreateChart(parseCreateChartArgs(args)),
    [executeCreateChart]
  );
  const executeCreatePivotTableTyped = useCallback(
    (args: unknown) => executeCreatePivotTable(parseCreatePivotTableArgs(args)),
    [executeCreatePivotTable]
  );
  const executeEditPivotTableTyped = useCallback(
    (args: unknown) => executeEditPivotTable(parseEditPivotTableArgs(args)),
    [executeEditPivotTable]
  );
  const executeConditionalFormatTyped = useCallback(
    (args: unknown) => executeConditionalFormat(parseConditionalFormatArgs(args)),
    [executeConditionalFormat]
  );
  const executeDataValidationTyped = useCallback(
    (args: unknown) => executeDataValidation(parseDataValidationArgs(args)),
    [executeDataValidation]
  );
  const executeEditChartTyped = useCallback(
    (args: unknown) => executeEditChart(parseEditChartArgs(args)),
    [executeEditChart]
  );

  /**
   * Wrapper del submit: lee Excel en vivo justo antes de enviar.
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

  /**
   * Envía una sugerencia de followup como nuevo mensaje de usuario.
   */
  const onSuggestedFollowup = useCallback(
    (suggestion: string) => {
      void append({ role: "user", content: suggestion });
    },
    [append]
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
          executeFormat={executeFormatTyped}
          executeCreateTable={executeCreateTableTyped}
          executeSortRange={executeSortRangeTyped}
          executeFilterRange={executeFilterRangeTyped}
          executeCreateChart={executeCreateChartTyped}
          executeCreatePivotTable={executeCreatePivotTableTyped}
          executeEditPivotTable={executeEditPivotTableTyped}
          executeConditionalFormat={executeConditionalFormatTyped}
          executeDataValidation={executeDataValidationTyped}
          executeEditChart={executeEditChartTyped}
          onToolResult={onToolResult}
          executingToolCallId={executingToolCallId}
          setExecutingToolCallId={setExecutingToolCallId}
          resolvedToolCallIds={resolvedConfirmToolsRef.current}
          onSuggestedFollowup={onSuggestedFollowup}
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
