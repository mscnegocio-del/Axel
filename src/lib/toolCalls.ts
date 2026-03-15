export const TOOL_READ_EXCEL_RANGE = "read_excel_range";
export const TOOL_WRITE_EXCEL_RANGE = "write_excel_range";

export type ReadRangeArgs = { range?: string };
export type WriteRangeArgs = {
  range?: string;
  sheetName?: string;
  data?: unknown[][];
};

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
