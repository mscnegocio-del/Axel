import { useState, useCallback } from "react";
import { useChat, type Message } from "ai/react";
import type { JSONValue } from "ai";
import {
  chatFetch,
  getChatApiUrl,
  prepareChatBody,
  getToolCallsAndResultsFromMessage,
  type ExcelContext,
  type AttachmentPayload,
} from "@/lib/assistant";
import { TokenUsageDisplay } from "@/components/billing/TokenUsageDisplay";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { AttachmentList } from "@/components/attachments/AttachmentList";
import { useExcelContext } from "@/hooks/useExcelContext";
import { useExcelWrite } from "@/hooks/useExcelWrite";
import { supabase } from "@/lib/supabase";
import { useFileAttachment, type Tier } from "@/hooks/useFileAttachment";

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
  const { excelContext } = useExcelContext();
  const attachmentState = useFileAttachment(tier);
  const executeWrite = useExcelWrite();
  const [executingToolCallId, setExecutingToolCallId] = useState<string | null>(null);

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
      excelContext,
      attachment: attachmentState.getAttachmentForRequest(),
    },
    experimental_prepareRequestBody: ({ messages: msgs, requestBody }) => {
      const extra = (requestBody ?? {}) as {
        excelContext?: ExcelContext;
        attachment?: AttachmentPayload | null;
      };
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
        excelContext: extra.excelContext ?? {},
        attachment: extra.attachment ?? undefined,
        toolCalls,
        toolResults,
      }) as JSONValue;
    },
    onResponse: (res) => {
      if (res.status === 429) {
        onLimitExceeded();
      }
    },
    // Tras cada envío exitoso: limpiar adjuntos y refrescar contador de tokens.
    onFinish: () => {
      attachmentState.clear();
      void tokenUsageRefetch();
    },
    onError: (err) => {
      if (err.message?.includes("429") || err.message?.includes("Límite")) {
        onLimitExceeded();
      }
    },
  });

  const onToolResult = useCallback(
    (_messageId: string, toolCallId: string, result: unknown) => {
      addToolResult({ toolCallId, result });
    },
    [addToolResult]
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
        {error && (
          <p className="text-destructive text-sm">{error.message}</p>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
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
