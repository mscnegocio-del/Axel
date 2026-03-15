import type { Message } from "ai/react";
import { cn } from "@/lib/utils";
import { ReadRangeCard, WriteRangeCard } from "./ToolCallCards";
import {
  TOOL_READ_EXCEL_RANGE,
  TOOL_WRITE_EXCEL_RANGE,
  parseReadRangeArgs,
  parseWriteRangeArgs,
} from "@/lib/toolCalls";

function getMessageContent(msg: Message): string {
  return typeof msg.content === "string" ? msg.content : String(msg.content ?? "");
}

function isToolInvocationWithState(
  inv: unknown
): inv is { state: "partial-call" | "call" | "result"; toolCallId: string; toolName: string; args?: unknown; result?: unknown } {
  return (
    inv != null &&
    typeof inv === "object" &&
    "state" in inv &&
    "toolCallId" in inv &&
    "toolName" in inv
  );
}

type ChatMessageListProps = {
  messages: Message[];
  isLoading: boolean;
  emptyMessage?: string;
  /** Ejecuta escritura en Excel (hoja, rango, datos). Usado por la tarjeta de write_excel_range. */
  executeWrite?: (sheetName: string, rangeAddress: string, data: unknown[][]) => Promise<{ success: true } | { success: false; error: string }>;
  /** Llamado al aprobar/cancelar una tool de escritura; el padre puede actualizar mensajes y hacer reload. */
  onToolResult?: (messageId: string, toolCallId: string, result: unknown) => void;
  /** Tool call id que está ejecutándose (para deshabilitar doble clic). */
  executingToolCallId?: string | null;
  /** Llamado al iniciar/finalizar la ejecución de una tool de escritura. */
  setExecutingToolCallId?: (id: string | null) => void;
};

export function ChatMessageList({
  messages,
  isLoading,
  emptyMessage = "Escribe un mensaje.",
  executeWrite,
  onToolResult,
  executingToolCallId = null,
  setExecutingToolCallId,
}: ChatMessageListProps) {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
      {messages.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      )}
      {messages.map((m) => (
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
          {m.role === "assistant" &&
            Array.isArray(m.toolInvocations) &&
            (m.toolInvocations as unknown[]).map((inv: unknown) => {
              if (!isToolInvocationWithState(inv)) return null;
              const { state, toolCallId, toolName, args, result: invResult } = inv;
              const key = `${m.id}-${toolCallId}`;

              if (toolName === TOOL_READ_EXCEL_RANGE) {
                const { range } = parseReadRangeArgs(args);
                return (
                  <ReadRangeCard
                    key={key}
                    range={range}
                    state={state as "partial-call" | "call" | "result"}
                    result={"result" in inv ? (inv as { result?: unknown }).result : undefined}
                  />
                );
              }

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
                    isExecuting={executingToolCallId === toolCallId}
                  />
                );
              }

              return null;
            })}
        </div>
      ))}
      {isLoading && (
        <div className="bg-muted mr-8 rounded-lg px-3 py-2 text-sm">…</div>
      )}
    </div>
  );
}
