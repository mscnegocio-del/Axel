// ── Constantes ────────────────────────────────────────────────────────────────

export const TOOL_READ_EXCEL_RANGE = "read_excel_range";
export const TOOL_WRITE_EXCEL_RANGE = "write_excel_range";
export const TOOL_LIST_SHEETS = "list_sheets";
export const TOOL_FORMAT_RANGE = "format_range";
export const TOOL_CREATE_TABLE = "create_table";
export const TOOL_SORT_RANGE = "sort_range";
export const TOOL_FILTER_RANGE = "filter_range";
export const TOOL_CREATE_CHART = "create_chart";
export const TOOL_NAVIGATE_TO_CELL = "navigate_to_cell";
export const TOOL_HIGHLIGHT_CELLS = "highlight_cells";

/** Tools que se ejecutan automáticamente sin confirmación del usuario. */
export const AUTO_EXECUTE_TOOLS = new Set([
  TOOL_READ_EXCEL_RANGE,
  TOOL_LIST_SHEETS,
  TOOL_NAVIGATE_TO_CELL,
  TOOL_HIGHLIGHT_CELLS,
]);

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ReadRangeArgs = { range?: string };
export type WriteRangeArgs = {
  range?: string;
  sheetName?: string;
  data?: unknown[][];
};
export type ListSheetsArgs = Record<string, never>;
export type FormatRangeArgs = {
  range?: string;
  sheetName?: string;
  fillColor?: string;
  bold?: boolean;
  fontColor?: string;
  numberFormat?: string;
};
export type CreateTableArgs = {
  range?: string;
  sheetName?: string;
  hasHeaders?: boolean;
  tableName?: string;
};
export type SortRangeArgs = {
  range?: string;
  sheetName?: string;
  columnIndex?: number;
  ascending?: boolean;
};
export type FilterRangeArgs = {
  range?: string;
  sheetName?: string;
  columnIndex?: number;
  criterion?: string;
};
export type CreateChartArgs = {
  range?: string;
  sheetName?: string;
  chartType?: string;
  title?: string;
};
export type NavigateToCellArgs = {
  range?: string;
  sheetName?: string;
};
export type HighlightCellsArgs = {
  range?: string;
  sheetName?: string;
  color?: string;
};

// ── Parsers ───────────────────────────────────────────────────────────────────

export function parseReadRangeArgs(args: unknown): ReadRangeArgs {
  if (args && typeof args === "object" && "range" in args) {
    return { range: String((args as ReadRangeArgs).range ?? "") };
  }
  return {};
}

export function parseWriteRangeArgs(args: unknown): WriteRangeArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    range: typeof o.range === "string" ? o.range : undefined,
    sheetName: typeof o.sheetName === "string" ? o.sheetName : undefined,
    data: Array.isArray(o.data) ? (o.data as unknown[][]) : undefined,
  };
}

export function parseFormatRangeArgs(args: unknown): FormatRangeArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    range: typeof o.range === "string" ? o.range : undefined,
    sheetName: typeof o.sheetName === "string" ? o.sheetName : undefined,
    fillColor: typeof o.fillColor === "string" ? o.fillColor : undefined,
    bold: typeof o.bold === "boolean" ? o.bold : undefined,
    fontColor: typeof o.fontColor === "string" ? o.fontColor : undefined,
    numberFormat: typeof o.numberFormat === "string" ? o.numberFormat : undefined,
  };
}

export function parseCreateTableArgs(args: unknown): CreateTableArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    range: typeof o.range === "string" ? o.range : undefined,
    sheetName: typeof o.sheetName === "string" ? o.sheetName : undefined,
    hasHeaders: typeof o.hasHeaders === "boolean" ? o.hasHeaders : true,
    tableName: typeof o.tableName === "string" ? o.tableName : undefined,
  };
}

export function parseSortRangeArgs(args: unknown): SortRangeArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    range: typeof o.range === "string" ? o.range : undefined,
    sheetName: typeof o.sheetName === "string" ? o.sheetName : undefined,
    columnIndex: typeof o.columnIndex === "number" ? o.columnIndex : 0,
    ascending: typeof o.ascending === "boolean" ? o.ascending : true,
  };
}

export function parseFilterRangeArgs(args: unknown): FilterRangeArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    range: typeof o.range === "string" ? o.range : undefined,
    sheetName: typeof o.sheetName === "string" ? o.sheetName : undefined,
    columnIndex: typeof o.columnIndex === "number" ? o.columnIndex : 0,
    criterion: typeof o.criterion === "string" ? o.criterion : undefined,
  };
}

export function parseCreateChartArgs(args: unknown): CreateChartArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    range: typeof o.range === "string" ? o.range : undefined,
    sheetName: typeof o.sheetName === "string" ? o.sheetName : undefined,
    chartType: typeof o.chartType === "string" ? o.chartType : "ColumnClustered",
    title: typeof o.title === "string" ? o.title : undefined,
  };
}

export function parseNavigateToCellArgs(args: unknown): NavigateToCellArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    range: typeof o.range === "string" ? o.range : undefined,
    sheetName: typeof o.sheetName === "string" ? o.sheetName : undefined,
  };
}

export function parseHighlightCellsArgs(args: unknown): HighlightCellsArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    range: typeof o.range === "string" ? o.range : undefined,
    sheetName: typeof o.sheetName === "string" ? o.sheetName : undefined,
    color: typeof o.color === "string" ? o.color : "#FFFF00",
  };
}
