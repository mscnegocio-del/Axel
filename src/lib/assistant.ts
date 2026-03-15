import { getAuthHeaders } from "@/lib/api";
import { getBackendUrl } from "@/lib/api";

export type ExcelContext = {
  range?: string;
  sheetName?: string;
  data?: string | unknown[][];
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

/**
 * Prepara el body del POST /api/chat: message + excelContext + attachment.
 * Opcionalmente toolCalls y toolResults cuando se reenvía tras aprobar/cancelar una tool
 * (reload); el backend los usa para reconstruir el turno del asistente.
 */
export function prepareChatBody(options: {
  message: string;
  excelContext?: ExcelContext | null;
  attachment?: AttachmentPayload | null;
  toolCalls?: ToolCallForBody[];
  toolResults?: ToolResultForBody[];
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    message: options.message,
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
