import { useCallback } from "react";

type WriteRangeResult = { success: true } | { success: false; error: string };

/**
 * Escribe valores en un rango de Excel vía Office.js.
 * Solo disponible cuando el add-in corre dentro de Excel.
 */
export function useExcelWrite(): (
  sheetName: string,
  rangeAddress: string,
  values: unknown[][]
) => Promise<WriteRangeResult> {
  return useCallback(async (sheetName, rangeAddress, values) => {
    if (typeof Excel === "undefined") {
      return { success: false, error: "Excel no está disponible." };
    }
    try {
      await Excel.run(async (context) => {
        let sheet = context.workbook.worksheets.getItemOrNullObject(sheetName);
        await context.sync();
        if (sheet.isNullObject) {
          sheet = context.workbook.worksheets.add(sheetName);
        }
        // Obtener rango base y sus dimensiones actuales
        const range = sheet.getRange(rangeAddress);
        range.load(["rowCount", "columnCount"]);
        await context.sync();

        const valueRows = Array.isArray(values) ? values.length : 0;
        const valueCols =
          valueRows > 0 && Array.isArray(values[0]) ? (values[0] as unknown[]).length : 0;

        if (
          valueRows > 0 &&
          valueCols > 0 &&
          (valueRows !== range.rowCount || valueCols !== range.columnCount)
        ) {
          // Si las dimensiones no coinciden, usar solo la celda inicial
          // y dejar que Excel calcule el tamaño con getResizedRange.
          const startCell = rangeAddress.split(":")[0];
          const startRange = sheet.getRange(startCell);
          const dataRange = startRange.getResizedRange(valueRows - 1, valueCols - 1);
          dataRange.values = values as string[][];
        } else {
          // Coinciden, podemos escribir directamente en el rango original.
          range.values = values as string[][];
        }
        await context.sync();
      });
      return { success: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: message };
    }
  }, []);
}
