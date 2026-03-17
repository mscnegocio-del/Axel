import { getAuthHeaders } from "@/lib/api";
import { getBackendUrl } from "@/lib/api";

export type ExcelContext = {
  /** Nombre de la hoja activa */
  sheetName?: string;
  /** Dirección del rango seleccionado por el usuario (legacy: alias de selectedRange) */
  range?: string;
  /** Valores del rango usado — toda la hoja (legacy: alias de values) */
  data?: string | unknown[][];
  // --- Fase 1: contexto reactivo ---
  /** Dirección del rango usado completo de la hoja (usedRange.address) */
  address?: string;
  /** Valores del rango usado completo de la hoja */
  values?: unknown[][];
  /** Número de filas del rango usado */
  rowCount?: number;
  /** Número de columnas del rango usado */
  columnCount?: number;
  /** Dirección del rango seleccionado por el usuario */
  selectedRange?: string;
};

export type AttachmentPayload = {
  base64: string;
  mimeType: string;
  filename: string;
};

/**
 * Fetch para useChat que añade JWT de Clerk.
 * Si getToken() retorna null, getAuthHeaders() lanza y no se envía "Bearer null".
 */
export async function chatFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers = new Headers(init?.headers);
  const auth = new Headers(authHeaders);
  auth.forEach((value, key) => headers.set(key, value));
  return fetch(input, { ...init, headers });
}

export function getChatApiUrl(): string {
  return `${getBackendUrl().replace(/\/$/, "")}/chat`;
}

export type ToolCallForBody = { id: string; name: string; arguments: unknown };
export type ToolResultForBody = { toolCallId: string; toolName: string; result: unknown };

/** Máximo de filas a incluir en el bloque de contexto Excel inyectado en el mensaje. */
const MAX_CONTEXT_ROWS = 100;

/**
 * Formatea los datos de Excel como un bloque de texto TSV e inyecta al inicio del mensaje.
 * Garantiza que el modelo vea los datos incluso si el backend no reenvía excelContext.values
 * al contexto del modelo.
 */
function buildMessageWithExcelContext(
  message: string,
  ctx: ExcelContext | null | undefined
): string {
  if (!ctx?.values || ctx.values.length === 0 || !ctx.sheetName) return message;

  const rows = (ctx.values as unknown[][]).slice(0, MAX_CONTEXT_ROWS);
  const tsv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return s.includes("\t") ? `"${s}"` : s;
        })
        .join("\t")
    )
    .join("\n");

  const extra =
    ctx.values.length > MAX_CONTEXT_ROWS
      ? `\n[… ${ctx.values.length - MAX_CONTEXT_ROWS} filas más]`
      : "";

  const range = ctx.address ?? ctx.range ?? "";
  const header = `[Excel — Hoja: ${ctx.sheetName}${range ? `, Rango: ${range}` : ""}]`;

  return `${header}\n${tsv}${extra}\n\n${message}`;
}

/**
 * Prepara el body del POST /api/chat: message + excelContext + attachment.
 * Inyecta los datos de Excel en el campo `message` como bloque TSV para que el modelo
 * pueda responder preguntas sobre la hoja aunque el backend no procese excelContext.values.
 */
export function prepareChatBody(options: {
  message: string;
  excelContext?: ExcelContext | null;
  attachment?: AttachmentPayload | null;
  toolCalls?: ToolCallForBody[];
  toolResults?: ToolResultForBody[];
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    message: buildMessageWithExcelContext(options.message, options.excelContext),
  };
  if (options.excelContext && Object.keys(options.excelContext).length > 0) {
    body.excelContext = options.excelContext;
  }
  if (options.attachment) {
    body.attachment = options.attachment;
  }
  if (options.toolCalls && options.toolCalls.length > 0) {
    body.toolCalls = options.toolCalls;
  }
  if (options.toolResults && options.toolResults.length > 0) {
    body.toolResults = options.toolResults;
  }
  return body;
}

/**
 * Extrae toolCalls y toolResults del último mensaje del asistente (con toolInvocations)
 * para incluirlos en el body al hacer reload tras un tool result.
 */
export function getToolCallsAndResultsFromMessage(msg: {
  toolInvocations?: Array<{
    toolCallId?: string;
    toolName?: string;
    args?: unknown;
    state?: string;
    result?: unknown;
  }>;
}): { toolCalls: ToolCallForBody[]; toolResults: ToolResultForBody[] } {
  const invocations = msg.toolInvocations ?? [];
  const toolCalls: ToolCallForBody[] = [];
  const toolResults: ToolResultForBody[] = [];
  for (const inv of invocations) {
    const id = (inv as { toolCallId?: string }).toolCallId;
    const name = (inv as { toolName?: string }).toolName;
    const args = (inv as { args?: unknown }).args;
    if (id && name !== undefined) {
      toolCalls.push({ id, name, arguments: args ?? {} });
      if (inv.state === "result") {
        toolResults.push({
          toolCallId: id,
          toolName: name,
          result: (inv as { result?: unknown }).result,
        });
      }
    }
  }
  return { toolCalls, toolResults };
}
