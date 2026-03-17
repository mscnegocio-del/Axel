import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type {
  FormatRangeArgs,
  CreateTableArgs,
  SortRangeArgs,
  FilterRangeArgs,
  CreateChartArgs,
} from "@/lib/toolCalls";

// ── Shared helpers ────────────────────────────────────────────────────────────

type ToolState = "partial-call" | "call" | "result";

type ActionCardProps = {
  toolCallId: string;
  state: ToolState;
  result?: unknown;
  isExecuting?: boolean;
  /**
   * El usuario ya aprobó o canceló esta tool. Se usa para suprimir los botones
   * inmediatamente, antes de que `addToolResult` haya commitado el nuevo estado,
   * evitando que la tarjeta reaparezca en estado "call" durante el re-render.
   */
  isResolved?: boolean;
  onApprove: () => void;
  onCancel: () => void;
  label: string;
  successMessage?: string;
  children?: ReactNode;
};

function ActionCard({
  toolCallId,
  state,
  result,
  isExecuting = false,
  isResolved = false,
  onApprove,
  onCancel,
  label,
  successMessage = "Completado.",
  children,
}: ActionCardProps) {
  // isPending es false si el usuario ya resolvió la tool (isResolved),
  // aunque el estado del mensaje todavía no haya actualizado a "result".
  const isPending = (state === "call" || state === "partial-call") && !isResolved;
  const hasResult = state === "result";
  const isSuccess =
    result && typeof result === "object" && "success" in result
      ? (result as { success: boolean }).success
      : null;

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
          ? isSuccess === true
            ? successMessage
            : isSuccess === false
              ? "Error al ejecutar."
              : "Ejecutado."
          : label}
      </div>
      {isPending && children && (
        <div className="rounded border border-border bg-background p-2 text-xs">
          {children}
        </div>
      )}
      {isPending && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={isExecuting}
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {isExecuting ? "Ejecutando…" : "Aprobar"}
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
      )}
      {hasResult &&
        result != null &&
        typeof result === "object" &&
        "error" in result
        ? (
          <p className="text-destructive text-xs">
            {String((result as { error?: unknown }).error ?? "")}
          </p>
        )
        : null}
    </div>
  );
}

// ── AutoExecuteCard ───────────────────────────────────────────────────────────
// Tarjeta informativa para tools que se ejecutan automáticamente (sin confirmación).

type AutoExecuteCardProps = {
  state: ToolState;
  pendingLabel: string;
  doneLabel: string;
  result?: unknown;
};

export function AutoExecuteCard({
  state,
  pendingLabel,
  doneLabel,
  result,
}: AutoExecuteCardProps) {
  const hasError =
    state === "result" &&
    result &&
    typeof result === "object" &&
    "error" in result;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm",
        "mr-8"
      )}
      role="status"
    >
      {state === "result" ? (
        hasError ? (
          <span className="text-destructive text-xs">
            {String((result as { error?: unknown }).error ?? "")}
          </span>
        ) : (
          <span className="text-muted-foreground">{doneLabel}</span>
        )
      ) : (
        <span className="text-muted-foreground">{pendingLabel}</span>
      )}
    </div>
  );
}

// ── ReadRangeCard ─────────────────────────────────────────────────────────────

type ReadRangeCardProps = {
  range?: string;
  state: ToolState;
  result?: unknown;
};

export function ReadRangeCard({ range, state, result }: ReadRangeCardProps) {
  return (
    <AutoExecuteCard
      state={state}
      pendingLabel={range ? `Leyendo rango ${range}…` : "Leyendo rango…"}
      doneLabel="Rango leído."
      result={result}
    />
  );
}

// ── WriteRangeCard ────────────────────────────────────────────────────────────

type WriteRangeCardProps = {
  toolCallId: string;
  range?: string;
  sheetName?: string;
  data: unknown[][];
  state: ToolState;
  result?: unknown;
  onApprove: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
  isResolved?: boolean;
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
  isResolved = false,
}: WriteRangeCardProps) {
  const isPending = (state === "call" || state === "partial-call") && !isResolved;

  return (
    <ActionCard
      toolCallId={toolCallId}
      state={state}
      result={result}
      isExecuting={isExecuting}
      isResolved={isResolved}
      onApprove={onApprove}
      onCancel={onCancel}
      label={`Escribir en ${sheetName ?? "hoja"} · ${range ?? "rango"}`}
      successMessage="Datos escritos correctamente."
    >
      {isPending && Array.isArray(data) && data.length > 0 && (
        <div className="max-h-32 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {data.slice(0, 10).map((row, i) => (
                <tr key={i}>
                  {Array.isArray(row) &&
                    (row as unknown[]).slice(0, 6).map((cell, j) => (
                      <td key={j} className="border border-border px-1 py-0.5">
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
      )}
    </ActionCard>
  );
}

// ── FormatRangeCard ───────────────────────────────────────────────────────────

type FormatRangeCardProps = {
  toolCallId: string;
  args: FormatRangeArgs;
  state: ToolState;
  result?: unknown;
  onApprove: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
  isResolved?: boolean;
};

export function FormatRangeCard({
  toolCallId,
  args,
  state,
  result,
  onApprove,
  onCancel,
  isExecuting,
  isResolved,
}: FormatRangeCardProps) {
  const { range, sheetName, fillColor, bold, fontColor, numberFormat } = args;
  return (
    <ActionCard
      toolCallId={toolCallId}
      state={state}
      result={result}
      isExecuting={isExecuting}
      onApprove={onApprove}
      onCancel={onCancel}
      label={`Formatear ${range ?? "rango"} en ${sheetName ?? "hoja activa"}`}
      successMessage="Formato aplicado."
      isResolved={isResolved}
    >
      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {fillColor && (
          <>
            <dt className="text-muted-foreground">Relleno</dt>
            <dd className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-sm border border-border"
                style={{ background: fillColor }}
              />
              {fillColor}
            </dd>
          </>
        )}
        {bold !== undefined && (
          <>
            <dt className="text-muted-foreground">Negrita</dt>
            <dd>{bold ? "Sí" : "No"}</dd>
          </>
        )}
        {fontColor && (
          <>
            <dt className="text-muted-foreground">Color texto</dt>
            <dd className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-sm border border-border"
                style={{ background: fontColor }}
              />
              {fontColor}
            </dd>
          </>
        )}
        {numberFormat && (
          <>
            <dt className="text-muted-foreground">Formato nº</dt>
            <dd className="font-mono">{numberFormat}</dd>
          </>
        )}
      </dl>
    </ActionCard>
  );
}

// ── CreateTableCard ───────────────────────────────────────────────────────────

type CreateTableCardProps = {
  toolCallId: string;
  args: CreateTableArgs;
  state: ToolState;
  result?: unknown;
  onApprove: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
  isResolved?: boolean;
};

export function CreateTableCard({
  toolCallId,
  args,
  state,
  result,
  onApprove,
  onCancel,
  isExecuting,
  isResolved,
}: CreateTableCardProps) {
  const { range, sheetName, hasHeaders, tableName } = args;
  return (
    <ActionCard
      toolCallId={toolCallId}
      state={state}
      result={result}
      isExecuting={isExecuting}
      onApprove={onApprove}
      onCancel={onCancel}
      label={`Crear tabla en ${range ?? "rango"} (${sheetName ?? "hoja activa"})`}
      successMessage="Tabla creada correctamente."
      isResolved={isResolved}
    >
      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        <dt className="text-muted-foreground">Rango</dt>
        <dd>{range ?? "—"}</dd>
        <dt className="text-muted-foreground">Encabezados</dt>
        <dd>{hasHeaders ? "Sí" : "No"}</dd>
        {tableName && (
          <>
            <dt className="text-muted-foreground">Nombre</dt>
            <dd>{tableName}</dd>
          </>
        )}
      </dl>
    </ActionCard>
  );
}

// ── SortRangeCard ─────────────────────────────────────────────────────────────

type SortRangeCardProps = {
  toolCallId: string;
  args: SortRangeArgs;
  state: ToolState;
  result?: unknown;
  onApprove: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
  isResolved?: boolean;
};

export function SortRangeCard({
  toolCallId,
  args,
  state,
  result,
  onApprove,
  onCancel,
  isExecuting,
  isResolved,
}: SortRangeCardProps) {
  const { range, sheetName, columnIndex = 0, ascending = true } = args;
  return (
    <ActionCard
      toolCallId={toolCallId}
      state={state}
      result={result}
      isExecuting={isExecuting}
      onApprove={onApprove}
      onCancel={onCancel}
      label={`Ordenar ${range ?? "rango"} por columna ${columnIndex + 1}`}
      successMessage="Rango ordenado."
      isResolved={isResolved}
    >
      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        <dt className="text-muted-foreground">Rango</dt>
        <dd>{range ?? "—"}</dd>
        <dt className="text-muted-foreground">Columna</dt>
        <dd>{columnIndex + 1}</dd>
        <dt className="text-muted-foreground">Orden</dt>
        <dd>{ascending ? "Ascendente ↑" : "Descendente ↓"}</dd>
        {sheetName && (
          <>
            <dt className="text-muted-foreground">Hoja</dt>
            <dd>{sheetName}</dd>
          </>
        )}
      </dl>
    </ActionCard>
  );
}

// ── FilterRangeCard ───────────────────────────────────────────────────────────

type FilterRangeCardProps = {
  toolCallId: string;
  args: FilterRangeArgs;
  state: ToolState;
  result?: unknown;
  onApprove: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
  isResolved?: boolean;
};

export function FilterRangeCard({
  toolCallId,
  args,
  state,
  result,
  onApprove,
  onCancel,
  isExecuting,
  isResolved,
}: FilterRangeCardProps) {
  const { range, sheetName, columnIndex = 0, criterion } = args;
  return (
    <ActionCard
      toolCallId={toolCallId}
      state={state}
      result={result}
      isExecuting={isExecuting}
      onApprove={onApprove}
      onCancel={onCancel}
      label={`Filtrar columna ${columnIndex + 1} en ${range ?? "rango"}`}
      successMessage="Filtro aplicado."
      isResolved={isResolved}
    >
      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        <dt className="text-muted-foreground">Rango</dt>
        <dd>{range ?? "—"}</dd>
        <dt className="text-muted-foreground">Columna</dt>
        <dd>{columnIndex + 1}</dd>
        {criterion && (
          <>
            <dt className="text-muted-foreground">Criterio</dt>
            <dd>"{criterion}"</dd>
          </>
        )}
        {sheetName && (
          <>
            <dt className="text-muted-foreground">Hoja</dt>
            <dd>{sheetName}</dd>
          </>
        )}
      </dl>
    </ActionCard>
  );
}

// ── CreateChartCard ───────────────────────────────────────────────────────────

type CreateChartCardProps = {
  toolCallId: string;
  args: CreateChartArgs;
  state: ToolState;
  result?: unknown;
  onApprove: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
  isResolved?: boolean;
};

const CHART_TYPE_LABELS: Record<string, string> = {
  ColumnClustered: "Columnas agrupadas",
  BarClustered: "Barras agrupadas",
  Line: "Líneas",
  Pie: "Pastel",
  Area: "Área",
  Scatter: "Dispersión",
};

export function CreateChartCard({
  toolCallId,
  args,
  state,
  result,
  onApprove,
  onCancel,
  isExecuting,
  isResolved,
}: CreateChartCardProps) {
  const { range, sheetName, chartType = "ColumnClustered", title } = args;
  const typeLabel = CHART_TYPE_LABELS[chartType] ?? chartType;

  return (
    <ActionCard
      toolCallId={toolCallId}
      state={state}
      result={result}
      isExecuting={isExecuting}
      onApprove={onApprove}
      onCancel={onCancel}
      label={`Crear gráfico de ${typeLabel.toLowerCase()} con ${range ?? "rango"}`}
      successMessage="Gráfico creado."
      isResolved={isResolved}
    >
      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        <dt className="text-muted-foreground">Tipo</dt>
        <dd>{typeLabel}</dd>
        <dt className="text-muted-foreground">Datos</dt>
        <dd>{range ?? "—"}</dd>
        {title && (
          <>
            <dt className="text-muted-foreground">Título</dt>
            <dd>{title}</dd>
          </>
        )}
        {sheetName && (
          <>
            <dt className="text-muted-foreground">Hoja</dt>
            <dd>{sheetName}</dd>
          </>
        )}
      </dl>
    </ActionCard>
  );
}
