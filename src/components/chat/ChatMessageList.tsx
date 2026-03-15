import type { Message } from "ai/react";
import { cn } from "@/lib/utils";

function getMessageContent(msg: Message): string {
  return typeof msg.content === "string" ? msg.content : String(msg.content ?? "");
}

type ChatMessageListProps = {
  messages: Message[];
  isLoading: boolean;
  emptyMessage?: string;
};

export function ChatMessageList({
  messages,
  isLoading,
  emptyMessage = "Escribe un mensaje.",
}: ChatMessageListProps) {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
      {messages.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      )}
      {messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            m.role === "user"
              ? "bg-primary text-primary-foreground ml-8"
              : "bg-muted mr-8"
          )}
        >
          {getMessageContent(m)}
        </div>
      ))}
      {isLoading && (
        <div className="bg-muted mr-8 rounded-lg px-3 py-2 text-sm">…</div>
      )}
    </div>
  );
}
