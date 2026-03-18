import { useCallback } from "react";
import { useExcelWrite } from "@/hooks/useExcelWrite";
import {
  useExcelFormat,
  useExcelCreateTable,
  useExcelSortRange,
  useExcelFilterRange,
  useExcelCreateChart,
  useExcelCreatePivotTable,
  useExcelEditPivotTable,
  useExcelConditionalFormat,
  useExcelDataValidation,
  useExcelEditChart,
} from "@/hooks/useExcelTools";
import {
  parseFormatRangeArgs,
  parseCreateTableArgs,
  parseSortRangeArgs,
  parseFilterRangeArgs,
  parseCreateChartArgs,
  parseCreatePivotTableArgs,
  parseEditPivotTableArgs,
  parseConditionalFormatArgs,
  parseDataValidationArgs,
  parseEditChartArgs,
} from "@/lib/toolCalls";
import type { ToolResult } from "@/hooks/useExcelTools";

type ExecuteFn = (args: unknown) => Promise<ToolResult>;

export type ToolExecutors = {
  executeWrite: (sheetName: string, rangeAddress: string, values: unknown[][]) => Promise<ToolResult>;
  executeFormat: ExecuteFn;
  executeCreateTable: ExecuteFn;
  executeSortRange: ExecuteFn;
  executeFilterRange: ExecuteFn;
  executeCreateChart: ExecuteFn;
  executeCreatePivotTable: ExecuteFn;
  executeEditPivotTable: ExecuteFn;
  executeConditionalFormat: ExecuteFn;
  executeDataValidation: ExecuteFn;
  executeEditChart: ExecuteFn;
};

/**
 * Instancia todos los hooks de ejecución de Excel tools y devuelve un objeto
 * con cada función ya envuelta con su parser correspondiente.
 * Reemplaza los 11 hooks individuales + 10 useCallback wrappers de ChatPage.
 */
export function useToolExecutors(): ToolExecutors {
  const rawWrite = useExcelWrite();
  const rawFormat = useExcelFormat();
  const rawCreateTable = useExcelCreateTable();
  const rawSortRange = useExcelSortRange();
  const rawFilterRange = useExcelFilterRange();
  const rawCreateChart = useExcelCreateChart();
  const rawCreatePivotTable = useExcelCreatePivotTable();
  const rawEditPivotTable = useExcelEditPivotTable();
  const rawConditionalFormat = useExcelConditionalFormat();
  const rawDataValidation = useExcelDataValidation();
  const rawEditChart = useExcelEditChart();

  const executeFormat = useCallback(
    (args: unknown) => rawFormat(parseFormatRangeArgs(args)),
    [rawFormat]
  );
  const executeCreateTable = useCallback(
    (args: unknown) => rawCreateTable(parseCreateTableArgs(args)),
    [rawCreateTable]
  );
  const executeSortRange = useCallback(
    (args: unknown) => rawSortRange(parseSortRangeArgs(args)),
    [rawSortRange]
  );
  const executeFilterRange = useCallback(
    (args: unknown) => rawFilterRange(parseFilterRangeArgs(args)),
    [rawFilterRange]
  );
  const executeCreateChart = useCallback(
    (args: unknown) => rawCreateChart(parseCreateChartArgs(args)),
    [rawCreateChart]
  );
  const executeCreatePivotTable = useCallback(
    (args: unknown) => rawCreatePivotTable(parseCreatePivotTableArgs(args)),
    [rawCreatePivotTable]
  );
  const executeEditPivotTable = useCallback(
    (args: unknown) => rawEditPivotTable(parseEditPivotTableArgs(args)),
    [rawEditPivotTable]
  );
  const executeConditionalFormat = useCallback(
    (args: unknown) => rawConditionalFormat(parseConditionalFormatArgs(args)),
    [rawConditionalFormat]
  );
  const executeDataValidation = useCallback(
    (args: unknown) => rawDataValidation(parseDataValidationArgs(args)),
    [rawDataValidation]
  );
  const executeEditChart = useCallback(
    (args: unknown) => rawEditChart(parseEditChartArgs(args)),
    [rawEditChart]
  );

  return {
    executeWrite: rawWrite,
    executeFormat,
    executeCreateTable,
    executeSortRange,
    executeFilterRange,
    executeCreateChart,
    executeCreatePivotTable,
    executeEditPivotTable,
    executeConditionalFormat,
    executeDataValidation,
    executeEditChart,
  };
}
