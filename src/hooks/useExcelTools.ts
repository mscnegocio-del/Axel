import { useCallback } from "react";
import type {
  FormatRangeArgs,
  CreateTableArgs,
  SortRangeArgs,
  FilterRangeArgs,
  CreateChartArgs,
} from "@/lib/toolCalls";

export type ToolResult = { success: true } | { success: false; error: string };

/** Obtiene la hoja indicada o la activa si no se especifica. */
function getSheet(
  context: Excel.RequestContext,
  sheetName?: string
): Excel.Worksheet {
  return sheetName
    ? context.workbook.worksheets.getItem(sheetName)
    : context.workbook.worksheets.getActiveWorksheet();
}

/** Extrae la celda/rango sin el prefijo "Hoja!" si lo trae. */
function stripSheetPrefix(range: string): string {
  if (range.includes("!")) return range.slice(range.indexOf("!") + 1);
  return range;
}

function excelError(e: unknown): ToolResult {
  return { success: false, error: e instanceof Error ? e.message : String(e) };
}

// ── format_range ──────────────────────────────────────────────────────────────

export function useExcelFormat(): (
  args: FormatRangeArgs
) => Promise<ToolResult> {
  return useCallback(async (args) => {
    if (typeof Excel === "undefined") return { success: false, error: "Excel no disponible." };
    const { range, sheetName, fillColor, bold, fontColor, numberFormat } = args;
    if (!range) return { success: false, error: "No se especificó un rango." };
    try {
      await Excel.run(async (context) => {
        const sheet = getSheet(context, sheetName);
        const r = sheet.getRange(stripSheetPrefix(range));
        if (fillColor !== undefined) r.format.fill.color = fillColor;
        if (bold !== undefined) r.format.font.bold = bold;
        if (fontColor !== undefined) r.format.font.color = fontColor;
        if (numberFormat !== undefined) {
          r.load("cellCount");
          await context.sync();
          r.numberFormat = Array.from({ length: r.rowCount ?? 1 }, () =>
            Array.from({ length: r.columnCount ?? 1 }, () => numberFormat)
          );
        }
        await context.sync();
      });
      return { success: true };
    } catch (e) {
      return excelError(e);
    }
  }, []);
}

// ── create_table ──────────────────────────────────────────────────────────────

export function useExcelCreateTable(): (
  args: CreateTableArgs
) => Promise<ToolResult> {
  return useCallback(async (args) => {
    if (typeof Excel === "undefined") return { success: false, error: "Excel no disponible." };
    const { range, sheetName, hasHeaders = true, tableName } = args;
    if (!range) return { success: false, error: "No se especificó un rango." };
    try {
      await Excel.run(async (context) => {
        const sheet = getSheet(context, sheetName);
        const r = sheet.getRange(stripSheetPrefix(range));
        const table = sheet.tables.add(r, hasHeaders);
        if (tableName) table.name = tableName;
        await context.sync();
      });
      return { success: true };
    } catch (e) {
      return excelError(e);
    }
  }, []);
}

// ── sort_range ────────────────────────────────────────────────────────────────

export function useExcelSortRange(): (
  args: SortRangeArgs
) => Promise<ToolResult> {
  return useCallback(async (args) => {
    if (typeof Excel === "undefined") return { success: false, error: "Excel no disponible." };
    const { range, sheetName, columnIndex = 0, ascending = true } = args;
    if (!range) return { success: false, error: "No se especificó un rango." };
    try {
      await Excel.run(async (context) => {
        const sheet = getSheet(context, sheetName);
        const r = sheet.getRange(stripSheetPrefix(range));
        r.sort.apply([{ key: columnIndex, ascending }]);
        await context.sync();
      });
      return { success: true };
    } catch (e) {
      return excelError(e);
    }
  }, []);
}

// ── filter_range ──────────────────────────────────────────────────────────────

export function useExcelFilterRange(): (
  args: FilterRangeArgs
) => Promise<ToolResult> {
  return useCallback(async (args) => {
    if (typeof Excel === "undefined") return { success: false, error: "Excel no disponible." };
    const { range, sheetName, columnIndex = 0, criterion } = args;
    if (!range) return { success: false, error: "No se especificó un rango." };
    try {
      await Excel.run(async (context) => {
        const sheet = getSheet(context, sheetName);
        const r = sheet.getRange(stripSheetPrefix(range));
        sheet.autoFilter.apply(r, columnIndex, {
          criterion1: criterion ?? "",
          filterOn: Excel.FilterOn.values,
        });
        await context.sync();
      });
      return { success: true };
    } catch (e) {
      return excelError(e);
    }
  }, []);
}

// ── create_chart ──────────────────────────────────────────────────────────────

const CHART_TYPE_MAP: Record<string, Excel.ChartType> = {
  ColumnClustered: Excel.ChartType.columnClustered,
  BarClustered: Excel.ChartType.barClustered,
  Line: Excel.ChartType.line,
  Pie: Excel.ChartType.pie,
  Area: Excel.ChartType.area,
  Scatter: Excel.ChartType.xyscatter,
};

export function useExcelCreateChart(): (
  args: CreateChartArgs
) => Promise<ToolResult> {
  return useCallback(async (args) => {
    if (typeof Excel === "undefined") return { success: false, error: "Excel no disponible." };
    const { range, sheetName, chartType = "ColumnClustered", title } = args;
    if (!range) return { success: false, error: "No se especificó un rango." };
    try {
      await Excel.run(async (context) => {
        const sheet = getSheet(context, sheetName);
        const dataRange = sheet.getRange(stripSheetPrefix(range));
        const resolvedType =
          CHART_TYPE_MAP[chartType] ?? Excel.ChartType.columnClustered;
        const chart = sheet.charts.add(
          resolvedType,
          dataRange,
          Excel.ChartSeriesBy.auto
        );
        if (title) chart.title.text = title;
        // Posicionar el gráfico a la derecha del rango de datos.
        chart.setPosition(
          sheet.getRange("F2"),
          sheet.getRange("N20")
        );
        await context.sync();
      });
      return { success: true };
    } catch (e) {
      return excelError(e);
    }
  }, []);
}
