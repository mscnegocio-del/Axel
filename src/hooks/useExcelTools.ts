import { useCallback } from "react";
import type {
  FormatRangeArgs,
  CreateTableArgs,
  SortRangeArgs,
  FilterRangeArgs,
  CreateChartArgs,
  CreatePivotTableArgs,
  EditPivotTableArgs,
  ConditionalFormatArgs,
  DataValidationArgs,
  EditChartArgs,
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

// ── create_pivot_table ────────────────────────────────────────────────────────

export function useExcelCreatePivotTable(): (
  args: CreatePivotTableArgs
) => Promise<ToolResult> {
  return useCallback(async (args) => {
    if (typeof Excel === "undefined") return { success: false, error: "Excel no disponible." };
    const { sourceRange, destSheet, destRange, rows, values, filters } = args;
    if (!sourceRange) return { success: false, error: "No se especificó el rango origen (sourceRange)." };
    try {
      await Excel.run(async (context) => {
        const sheet = getSheet(context, destSheet);
        const srcSheet = getSheet(context, undefined);
        const srcRange = srcSheet.getRange(stripSheetPrefix(sourceRange));
        const destination = destRange ? sheet.getRange(stripSheetPrefix(destRange)) : sheet.getRange("A1");
        const pivot = sheet.pivotTables.add("PivotTable1", srcRange, destination);

        if (Array.isArray(rows)) {
          rows.forEach((fieldName) => {
            try {
              (pivot.rowHierarchies as any).add(fieldName);
            } catch {
              // Campo no encontrado; ignorar silenciosamente.
            }
          });
        }
        if (Array.isArray(values)) {
          values.forEach((fieldName) => {
            try {
              const hierarchy = (pivot.dataHierarchies as any).add(fieldName);
              hierarchy.summarizeBy = Excel.AggregationFunction.sum;
            } catch {
              // Ignorar campos inválidos.
            }
          });
        }
        if (Array.isArray(filters)) {
          filters.forEach((fieldName) => {
            try {
              (pivot.filterHierarchies as any).add(fieldName);
            } catch {
              // Ignorar.
            }
          });
        }

        await context.sync();
      });
      return { success: true };
    } catch (e) {
      return excelError(e);
    }
  }, []);
}

// ── edit_pivot_table ──────────────────────────────────────────────────────────

export function useExcelEditPivotTable(): (
  args: EditPivotTableArgs
) => Promise<ToolResult> {
  return useCallback(async (args) => {
    if (typeof Excel === "undefined") return { success: false, error: "Excel no disponible." };
    const { pivotName, operation } = args;
    if (!pivotName || !operation) {
      return { success: false, error: "Faltan parámetros para editar la tabla dinámica." };
    }
    try {
      await Excel.run(async (context) => {
        const sheet = getSheet(context, undefined);
        const pivot = sheet.pivotTables.getItem(pivotName);

        // Implementación mínima: permitir solo refresh por ahora.
        if (operation === "refresh") {
          pivot.refresh();
        }

        await context.sync();
      });
      return { success: true };
    } catch (e) {
      return excelError(e);
    }
  }, []);
}

// ── conditional_format ────────────────────────────────────────────────────────

export function useExcelConditionalFormat(): (
  args: ConditionalFormatArgs
) => Promise<ToolResult> {
  return useCallback(async (args) => {
    if (typeof Excel === "undefined") return { success: false, error: "Excel no disponible." };
    const { range, sheetName, ruleType, criteria, format } = args;
    if (!range || !ruleType) return { success: false, error: "Faltan parámetros para formato condicional." };
    try {
      await Excel.run(async (context) => {
        const sheet = getSheet(context, sheetName);
        const r = sheet.getRange(stripSheetPrefix(range));
        let cf: Excel.ConditionalFormat;

        if (ruleType === "greater_than") {
          cf = r.conditionalFormats.add(Excel.ConditionalFormatType.cellValue);
          cf.cellValue.rule = {
            operator: Excel.ConditionalCellValueOperator.greaterThan,
            formula1: String(criteria ?? "0"),
          };
        } else if (ruleType === "contains_text") {
          cf = r.conditionalFormats.add(Excel.ConditionalFormatType.containsText);
          cf.textComparison.rule = {
            operator: Excel.ConditionalTextOperator.contains,
            text: String(criteria ?? ""),
          };
        } else {
          // Regla genérica: si no reconocemos el tipo, no hacemos nada grave.
          await context.sync();
          return;
        }

        if (format) {
          const baseFormat = (cf as any).format;
          if (format.fillColor) baseFormat.fill.color = format.fillColor;
          if (format.fontColor) baseFormat.font.color = format.fontColor;
          if (typeof format.bold === "boolean") baseFormat.font.bold = format.bold;
        }

        await context.sync();
      });
      return { success: true };
    } catch (e) {
      return excelError(e);
    }
  }, []);
}

// ── data_validation ───────────────────────────────────────────────────────────

export function useExcelDataValidation(): (
  args: DataValidationArgs
) => Promise<ToolResult> {
  return useCallback(async (args) => {
    if (typeof Excel === "undefined") return { success: false, error: "Excel no disponible." };
    const { range, sheetName, type, list, min, max } = args;
    if (!range || !type) return { success: false, error: "Faltan parámetros para validación de datos." };
    try {
      await Excel.run(async (context) => {
        const sheet = getSheet(context, sheetName);
        const r = sheet.getRange(stripSheetPrefix(range));

        if (type === "list" && Array.isArray(list)) {
          const formula = `"${list.join(",")}"`;
          (r.dataValidation as any).rule = {
            type: Excel.DataValidationType.list,
            inCellDropDown: true,
            formula1: formula,
          };
        } else if (type === "wholeNumber") {
          (r.dataValidation as any).rule = {
            type: Excel.DataValidationType.wholeNumber,
            operator: Excel.DataValidationOperator.between,
            formula1: min != null ? String(min) : "0",
            formula2: max != null ? String(max) : String(min ?? 0),
          };
        } else if (type === "decimal") {
          (r.dataValidation as any).rule = {
            type: Excel.DataValidationType.decimal,
            operator: Excel.DataValidationOperator.between,
            formula1: min != null ? String(min) : "0",
            formula2: max != null ? String(max) : String(min ?? 0),
          };
        }

        await context.sync();
      });
      return { success: true };
    } catch (e) {
      return excelError(e);
    }
  }, []);
}

// ── edit_chart ────────────────────────────────────────────────────────────────

export function useExcelEditChart(): (
  args: EditChartArgs
) => Promise<ToolResult> {
  return useCallback(async (args) => {
    if (typeof Excel === "undefined") return { success: false, error: "Excel no disponible." };
    const { chartName, property, value } = args;
    if (!chartName || !property) {
      return { success: false, error: "Faltan parámetros para editar el gráfico." };
    }
    try {
      await Excel.run(async (context) => {
        const sheet = getSheet(context, undefined);
        const chart = sheet.charts.getItem(chartName);

        switch (property) {
          case "title":
            chart.title.text = String(value ?? "");
            break;
          default:
            // Propiedades adicionales se pueden mapear aquí en el futuro.
            break;
        }

        await context.sync();
      });
      return { success: true };
    } catch (e) {
      return excelError(e);
    }
  }, []);
}
