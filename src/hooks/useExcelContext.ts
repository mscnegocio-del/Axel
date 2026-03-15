import { useCallback, useEffect, useState } from "react";
import type { ExcelContext } from "@/lib/assistant";

type UseExcelContextResult = {
  excelContext: ExcelContext;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

/**
 * Lee el rango seleccionado y la hoja activa vía Office.js.
 * El backend recibe solo este contexto (no historial de mensajes).
 */
export function useExcelContext(): UseExcelContextResult {
  const [excelContext, setExcelContext] = useState<ExcelContext>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (typeof Excel === "undefined") {
      setExcelContext({});
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        sheet.load("name");
        const range = context.workbook.getSelectedRange();
        range.load("address");
        range.load("values");
        await context.sync();
        setExcelContext({
          range: range.address,
          sheetName: sheet.name,
          data: range.values as unknown[][],
        });
      });
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setExcelContext({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof Excel === "undefined") return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refresh]);

  return { excelContext, isLoading, error, refresh };
}
