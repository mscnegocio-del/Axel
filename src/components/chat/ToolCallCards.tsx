import { cn } from "@/lib/utils";

type ReadRangeCardProps = {
  range?: string;
  state: "partial-call" | "call" | "result";
  result?: unknown;
};

export function ReadRangeCard({ range, state }: ReadRangeCardProps) {
  const label = range ? `Leyendo rango ${range}…` : "Leyendo rango…";
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm",
        "mr-8"
      )}
      role="status"
    >
      {state === "result" ? (
        <span className="text-muted-foreground">Rango leído.</span>
      ) : (
        <span className="text-muted-foreground">{label}</span>
      )}
    </div>
  );
}

type WriteRangeCardProps = {
  toolCallId: string;
  range?: string;
  sheetName?: string;
  data: unknown[][];
  state: "partial-call" | "call" | "result";
  result?: unknown;
  onApprove: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
};

export function WriteRangeCard({
  toolCallId,
  range,
  sheetName,
  data,
  state,
  result,
  onApprove,
  onCancel,
  isExecuting = false,
}: WriteRangeCardProps) {
  const isPending = state === "call" || state === "partial-call";
  const hasResult = state === "result";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm",
        "mr-8 flex flex-col gap-2"
      )}
      data-tool-call-id={toolCallId}
    >
      <div className="text-muted-foreground">
        {hasResult
          ? result && typeof result === "object" && "success" in result
            ? (result as { success: boolean }).success
              ? "Datos escritos correctamente."
              : "Error al escribir."
            : "Ejecutado."
          : `Escribir en ${sheetName ?? "hoja"} · ${range ?? "rango"}`}
      </div>
      {isPending && Array.isArray(data) && data.length > 0 && (
        <>
          <div className="max-h-32 overflow-auto rounded border border-border bg-background p-2">
            <table className="w-full border-collapse text-xs">
              <tbody>
                {data.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {Array.isArray(row) &&
                      (row as unknown[]).slice(0, 6).map((cell, j) => (
                        <td
                          key={j}
                          className="border border-border px-1 py-0.5"
                        >
                          {String(cell ?? "")}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 10 && (
              <p className="text-muted-foreground mt-1 text-xs">
                … y {data.length - 10} filas más
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onApprove}
              disabled={isExecuting}
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {isExecuting ? "Escribiendo…" : "Aprobar"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isExecuting}
              className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </>
      )}
      {hasResult && result && typeof result === "object" && "error" in result
        ? (() => {
            const err = (result as { error?: string }).error;
            return <p className="text-destructive text-xs">{err != null ? String(err) : ""}</p>;
          })()
        : null}
    </div>
  );
}
