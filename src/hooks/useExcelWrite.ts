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
        const range = sheet.getRange(rangeAddress);
        range.values = values as string[][];
        await context.sync();
      });
      return { success: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: message };
    }
  }, []);
}
