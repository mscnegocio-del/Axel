import type { Message } from "ai/react";
import { cn } from "@/lib/utils";
import {
  AutoExecuteCard,
  ReadRangeCard,
  WriteRangeCard,
  FormatRangeCard,
  CreateTableCard,
  SortRangeCard,
  FilterRangeCard,
  CreateChartCard,
} from "./ToolCallCards";
import { SuggestedFollowups, extractFollowups } from "./SuggestedFollowups";
import {
  TOOL_READ_EXCEL_RANGE,
  TOOL_WRITE_EXCEL_RANGE,
  TOOL_LIST_SHEETS,
  TOOL_FORMAT_RANGE,
  TOOL_CREATE_TABLE,
  TOOL_SORT_RANGE,
  TOOL_FILTER_RANGE,
  TOOL_CREATE_CHART,
  TOOL_NAVIGATE_TO_CELL,
  TOOL_HIGHLIGHT_CELLS,
  parseReadRangeArgs,
  parseWriteRangeArgs,
  parseFormatRangeArgs,
  parseCreateTableArgs,
  parseSortRangeArgs,
  parseFilterRangeArgs,
  parseCreateChartArgs,
  parseNavigateToCellArgs,
  parseHighlightCellsArgs,
} from "@/lib/toolCalls";
import type { ToolResult } from "@/hooks/useExcelTools";

type ToolState = "partial-call" | "call" | "result";

function getMessageContent(msg: Message): string {
  return typeof msg.content === "string" ? msg.content : String(msg.content ?? "");
}

function isToolInvocationWithState(
  inv: unknown
): inv is {
  state: ToolState;
  toolCallId: string;
  toolName: string;
  args?: unknown;
  result?: unknown;
} {
  return (
    inv != null &&
    typeof inv === "object" &&
    "state" in inv &&
    "toolCallId" in inv &&
    "toolName" in inv
  );
}

type ExecuteFn = (args: unknown) => Promise<ToolResult>;

type ChatMessageListProps = {
  messages: Message[];
  isLoading: boolean;
  emptyMessage?: string;
  /** Funciones de ejecución para tools con confirmación */
  executeWrite?: (sheetName: string, rangeAddress: string, data: unknown[][]) => Promise<ToolResult>;
  executeFormat?: ExecuteFn;
  executeCreateTable?: ExecuteFn;
  executeSortRange?: ExecuteFn;
  executeFilterRange?: ExecuteFn;
  executeCreateChart?: ExecuteFn;
  /** Llamado al resolver cualquier tool (aprobar/cancelar) */
  onToolResult?: (messageId: string, toolCallId: string, result: unknown) => void;
  /** Tool call id ejecutándose actualmente */
  executingToolCallId?: string | null;
  setExecutingToolCallId?: (id: string | null) => void;
  /** Llamado al hacer clic en un followup sugerido */
  onSuggestedFollowup?: (suggestion: string) => void;
};

export function ChatMessageList({
  messages,
  isLoading,
  emptyMessage = "Escribe un mensaje.",
  executeWrite,
  executeFormat,
  executeCreateTable,
  executeSortRange,
  executeFilterRange,
  executeCreateChart,
  onToolResult,
  executingToolCallId = null,
  setExecutingToolCallId,
  onSuggestedFollowup,
}: ChatMessageListProps) {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
      {messages.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      )}
      {messages.map((m, msgIndex) => {
        const isLastAssistant =
          m.role === "assistant" && msgIndex === messages.length - 1;

        const followups = isLastAssistant
          ? extractFollowups(
              (m as unknown as { annotations?: unknown[] }).annotations
            )
          : [];

        return (
          <div key={m.id} className="space-y-2">
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground ml-8"
                  : "bg-muted mr-8"
              )}
            >
              {getMessageContent(m)}
            </div>

            {/* Tool invocations */}
            {m.role === "assistant" &&
              Array.isArray(m.toolInvocations) &&
              (m.toolInvocations as unknown[]).map((inv: unknown) => {
                if (!isToolInvocationWithState(inv)) return null;
                const { state, toolCallId, toolName, args, result: invResult } = inv;
                const key = `${m.id}-${toolCallId}`;

                // ── Auto-execute: read_excel_range ──────────────────────────
                if (toolName === TOOL_READ_EXCEL_RANGE) {
                  const { range } = parseReadRangeArgs(args);
                  return (
                    <ReadRangeCard
                      key={key}
                      range={range}
                      state={state}
                      result={invResult}
                    />
                  );
                }

                // ── Auto-execute: list_sheets ───────────────────────────────
                if (toolName === TOOL_LIST_SHEETS) {
                  const sheets =
                    state === "result" &&
                    invResult &&
                    typeof invResult === "object" &&
                    "sheets" in invResult &&
                    Array.isArray((invResult as { sheets?: unknown }).sheets)
                      ? ((invResult as { sheets: unknown[] }).sheets as string[]).join(", ")
                      : null;
                  return (
                    <AutoExecuteCard
                      key={key}
                      state={state}
                      pendingLabel="Listando hojas…"
                      doneLabel={sheets ? `Hojas: ${sheets}` : "Hojas listadas."}
                      result={invResult}
                    />
                  );
                }

                // ── Auto-execute: navigate_to_cell ──────────────────────────
                if (toolName === TOOL_NAVIGATE_TO_CELL) {
                  const { range } = parseNavigateToCellArgs(args);
                  return (
                    <AutoExecuteCard
                      key={key}
                      state={state}
                      pendingLabel={range ? `Navegando a ${range}…` : "Navegando…"}
                      doneLabel="Navegación completada."
                      result={invResult}
                    />
                  );
                }

                // ── Auto-execute: highlight_cells ───────────────────────────
                if (toolName === TOOL_HIGHLIGHT_CELLS) {
                  const { range } = parseHighlightCellsArgs(args);
                  return (
                    <AutoExecuteCard
                      key={key}
                      state={state}
                      pendingLabel={range ? `Resaltando ${range}…` : "Resaltando celdas…"}
                      doneLabel="Celdas resaltadas."
                      result={invResult}
                    />
                  );
                }

                // ── Confirm: write_excel_range ──────────────────────────────
                if (toolName === TOOL_WRITE_EXCEL_RANGE) {
                  const { range, sheetName, data } = parseWriteRangeArgs(args);
                  const dataArray = Array.isArray(data) ? data : [];
                  return (
                    <WriteRangeCard
                      key={key}
                      toolCallId={toolCallId}
                      range={range}
                      sheetName={sheetName}
                      data={dataArray}
                      state={state}
                      result={invResult}
                      isExecuting={executingToolCallId === toolCallId}
                      onApprove={async () => {
                        if (!executeWrite || !onToolResult || !range || !sheetName) return;
                        setExecutingToolCallId?.(toolCallId);
                        try {
                          const result = await executeWrite(sheetName, range, dataArray);
                          onToolResult(m.id, toolCallId, result);
                        } finally {
                          setExecutingToolCallId?.(null);
                        }
                      }}
                      onCancel={() => {
                        onToolResult?.(m.id, toolCallId, { cancelled: true });
                      }}
                    />
                  );
                }

                // ── Confirm: format_range ───────────────────────────────────
                if (toolName === TOOL_FORMAT_RANGE) {
                  const parsedArgs = parseFormatRangeArgs(args);
                  return (
                    <FormatRangeCard
                      key={key}
                      toolCallId={toolCallId}
                      args={parsedArgs}
                      state={state}
                      result={invResult}
                      isExecuting={executingToolCallId === toolCallId}
                      onApprove={async () => {
                        if (!executeFormat || !onToolResult) return;
                        setExecutingToolCallId?.(toolCallId);
                        try {
                          const result = await executeFormat(parsedArgs);
                          onToolResult(m.id, toolCallId, result);
                        } finally {
                          setExecutingToolCallId?.(null);
                        }
                      }}
                      onCancel={() => {
                        onToolResult?.(m.id, toolCallId, { cancelled: true });
                      }}
                    />
                  );
                }

                // ── Confirm: create_table ───────────────────────────────────
                if (toolName === TOOL_CREATE_TABLE) {
                  const parsedArgs = parseCreateTableArgs(args);
                  return (
                    <CreateTableCard
                      key={key}
                      toolCallId={toolCallId}
                      args={parsedArgs}
                      state={state}
                      result={invResult}
                      isExecuting={executingToolCallId === toolCallId}
                      onApprove={async () => {
                        if (!executeCreateTable || !onToolResult) return;
                        setExecutingToolCallId?.(toolCallId);
                        try {
                          const result = await executeCreateTable(parsedArgs);
                          onToolResult(m.id, toolCallId, result);
                        } finally {
                          setExecutingToolCallId?.(null);
                        }
                      }}
                      onCancel={() => {
                        onToolResult?.(m.id, toolCallId, { cancelled: true });
                      }}
                    />
                  );
                }

                // ── Confirm: sort_range ─────────────────────────────────────
                if (toolName === TOOL_SORT_RANGE) {
                  const parsedArgs = parseSortRangeArgs(args);
                  return (
                    <SortRangeCard
                      key={key}
                      toolCallId={toolCallId}
                      args={parsedArgs}
                      state={state}
                      result={invResult}
                      isExecuting={executingToolCallId === toolCallId}
                      onApprove={async () => {
                        if (!executeSortRange || !onToolResult) return;
                        setExecutingToolCallId?.(toolCallId);
                        try {
                          const result = await executeSortRange(parsedArgs);
                          onToolResult(m.id, toolCallId, result);
                        } finally {
                          setExecutingToolCallId?.(null);
                        }
                      }}
                      onCancel={() => {
                        onToolResult?.(m.id, toolCallId, { cancelled: true });
                      }}
                    />
                  );
                }

                // ── Confirm: filter_range ───────────────────────────────────
                if (toolName === TOOL_FILTER_RANGE) {
                  const parsedArgs = parseFilterRangeArgs(args);
                  return (
                    <FilterRangeCard
                      key={key}
                      toolCallId={toolCallId}
                      args={parsedArgs}
                      state={state}
                      result={invResult}
                      isExecuting={executingToolCallId === toolCallId}
                      onApprove={async () => {
                        if (!executeFilterRange || !onToolResult) return;
                        setExecutingToolCallId?.(toolCallId);
                        try {
                          const result = await executeFilterRange(parsedArgs);
                          onToolResult(m.id, toolCallId, result);
                        } finally {
                          setExecutingToolCallId?.(null);
                        }
                      }}
                      onCancel={() => {
                        onToolResult?.(m.id, toolCallId, { cancelled: true });
                      }}
                    />
                  );
                }

                // ── Confirm: create_chart ───────────────────────────────────
                if (toolName === TOOL_CREATE_CHART) {
                  const parsedArgs = parseCreateChartArgs(args);
                  return (
                    <CreateChartCard
                      key={key}
                      toolCallId={toolCallId}
                      args={parsedArgs}
                      state={state}
                      result={invResult}
                      isExecuting={executingToolCallId === toolCallId}
                      onApprove={async () => {
                        if (!executeCreateChart || !onToolResult) return;
                        setExecutingToolCallId?.(toolCallId);
                        try {
                          const result = await executeCreateChart(parsedArgs);
                          onToolResult(m.id, toolCallId, result);
                        } finally {
                          setExecutingToolCallId?.(null);
                        }
                      }}
                      onCancel={() => {
                        onToolResult?.(m.id, toolCallId, { cancelled: true });
                      }}
                    />
                  );
                }

                return null;
              })}

            {/* Suggested followups — solo después del último mensaje del asistente */}
            {isLastAssistant && followups.length > 0 && onSuggestedFollowup && (
              <SuggestedFollowups
                suggestions={followups}
                onSelect={onSuggestedFollowup}
              />
            )}
          </div>
        );
      })}
      {isLoading && (
        <div className="bg-muted mr-8 rounded-lg px-3 py-2 text-sm">…</div>
      )}
    </div>
  );
}
