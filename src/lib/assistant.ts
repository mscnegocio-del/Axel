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

/**
 * Prepara el body del POST /api/chat: solo message + excelContext + attachment.
 * El backend no persiste historial. No incluir nunca el array de mensajes:
 * experimental_prepareRequestBody reemplaza por completo el body del request,
 * así que el historial local (messages) no se envía al backend.
 */
export function prepareChatBody(options: {
  message: string;
  excelContext?: ExcelContext | null;
  attachment?: AttachmentPayload | null;
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
  return body;
}
