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

// Fase 3 — tools avanzadas
export const TOOL_CREATE_PIVOT_TABLE = "create_pivot_table";
export const TOOL_EDIT_PIVOT_TABLE = "edit_pivot_table";
export const TOOL_CONDITIONAL_FORMAT = "conditional_format";
export const TOOL_DATA_VALIDATION = "data_validation";
export const TOOL_EDIT_CHART = "edit_chart";

// Fase 4 — skills
export const TOOL_SAVE_SKILL = "save_skill";
export const TOOL_RUN_SKILL = "run_skill";
export const TOOL_LIST_SKILLS = "list_skills";

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

// Fase 3 — tipos avanzados
export type CreatePivotTableArgs = {
  sourceRange?: string;
  destSheet?: string;
  destRange?: string;
  rows?: string[];
  values?: string[];
  filters?: string[];
};

export type EditPivotTableArgs = {
  pivotName?: string;
  operation?: string;
  params?: Record<string, unknown>;
};

export type ConditionalFormatArgs = {
  range?: string;
  sheetName?: string;
  ruleType?: string;
  criteria?: string | number;
  format?: {
    fillColor?: string;
    fontColor?: string;
    bold?: boolean;
  };
};

export type DataValidationArgs = {
  range?: string;
  sheetName?: string;
  type?: string;
  list?: string[];
  min?: number;
  max?: number;
};

export type EditChartArgs = {
  chartName?: string;
  property?: string;
  value?: unknown;
};

// Fase 4 — skills
export type SaveSkillArgs = {
  skillName?: string;
  description?: string;
};

export type RunSkillArgs = {
  skillName?: string;
  contextOverrides?: Record<string, unknown>;
};

export type ListSkillsArgs = Record<string, never>;

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

export function parseCreatePivotTableArgs(args: unknown): CreatePivotTableArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    sourceRange: typeof o.sourceRange === "string" ? o.sourceRange : undefined,
    destSheet: typeof o.destSheet === "string" ? o.destSheet : undefined,
    destRange: typeof o.destRange === "string" ? o.destRange : undefined,
    rows: Array.isArray(o.rows) ? (o.rows as string[]) : undefined,
    values: Array.isArray(o.values) ? (o.values as string[]) : undefined,
    filters: Array.isArray(o.filters) ? (o.filters as string[]) : undefined,
  };
}

export function parseEditPivotTableArgs(args: unknown): EditPivotTableArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    pivotName: typeof o.pivotName === "string" ? o.pivotName : undefined,
    operation: typeof o.operation === "string" ? o.operation : undefined,
    params: o.params && typeof o.params === "object" ? (o.params as Record<string, unknown>) : undefined,
  };
}

export function parseConditionalFormatArgs(args: unknown): ConditionalFormatArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  const format = o.format && typeof o.format === "object" ? (o.format as Record<string, unknown>) : undefined;
  return {
    range: typeof o.range === "string" ? o.range : undefined,
    sheetName: typeof o.sheetName === "string" ? o.sheetName : undefined,
    ruleType: typeof o.ruleType === "string" ? o.ruleType : undefined,
    criteria:
      typeof o.criteria === "string" || typeof o.criteria === "number" ? (o.criteria as string | number) : undefined,
    format: format
      ? {
          fillColor: typeof format.fillColor === "string" ? (format.fillColor as string) : undefined,
          fontColor: typeof format.fontColor === "string" ? (format.fontColor as string) : undefined,
          bold: typeof format.bold === "boolean" ? (format.bold as boolean) : undefined,
        }
      : undefined,
  };
}

export function parseDataValidationArgs(args: unknown): DataValidationArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    range: typeof o.range === "string" ? o.range : undefined,
    sheetName: typeof o.sheetName === "string" ? o.sheetName : undefined,
    type: typeof o.type === "string" ? o.type : undefined,
    list: Array.isArray(o.list) ? (o.list as string[]) : undefined,
    min: typeof o.min === "number" ? o.min : undefined,
    max: typeof o.max === "number" ? o.max : undefined,
  };
}

export function parseEditChartArgs(args: unknown): EditChartArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    chartName: typeof o.chartName === "string" ? o.chartName : undefined,
    property: typeof o.property === "string" ? o.property : undefined,
    value: o.value,
  };
}

export function parseSaveSkillArgs(args: unknown): SaveSkillArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    skillName: typeof o.skillName === "string" ? o.skillName : undefined,
    description: typeof o.description === "string" ? o.description : undefined,
  };
}

export function parseRunSkillArgs(args: unknown): RunSkillArgs {
  if (!args || typeof args !== "object") return {};
  const o = args as Record<string, unknown>;
  return {
    skillName: typeof o.skillName === "string" ? o.skillName : undefined,
    contextOverrides:
      o.contextOverrides && typeof o.contextOverrides === "object"
        ? (o.contextOverrides as Record<string, unknown>)
        : undefined,
  };
}

export function parseListSkillsArgs(_args: unknown): ListSkillsArgs {
  return {};
}
