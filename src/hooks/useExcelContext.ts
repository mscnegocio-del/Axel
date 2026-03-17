import { useCallback, useEffect, useRef, useState } from "react";
import type { ExcelContext } from "@/lib/assistant";

export type UseExcelContextResult = {
  /** Contexto actual — se actualiza por listeners y refresh; usar para la UI. */
  excelContext: ExcelContext;
  /**
   * Lee el contexto fresco de Excel justo antes de enviar un mensaje.
   * Actualiza el estado interno y devuelve el contexto más reciente.
   * Si Excel no está disponible o lanza, devuelve el último contexto conocido.
   */
  getContextForMessage: () => Promise<ExcelContext>;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

/** Espera en ms entre el último cambio detectado y la actualización del contexto. */
const CHANGE_DEBOUNCE_MS = 400;

/**
 * Lee el contexto completo de Excel: hoja activa, usedRange y rango seleccionado.
 * Requiere que Excel esté disponible (add-in cargado dentro de Excel).
 */
async function readExcelContext(): Promise<ExcelContext> {
  if (typeof Excel === "undefined") return {};

  return Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    sheet.load("name");

    const selectedRange = context.workbook.getSelectedRange();
    selectedRange.load("address");

    // getUsedRangeOrNullObject es seguro: isNullObject == true si la hoja está vacía
    const usedRange = sheet.getUsedRangeOrNullObject();
    usedRange.load("isNullObject");

    await context.sync();

    const ctx: ExcelContext = {
      sheetName: sheet.name,
      selectedRange: selectedRange.address,
      range: selectedRange.address,
    };

    if (!usedRange.isNullObject) {
      usedRange.load(["address", "values", "rowCount", "columnCount"]);
      await context.sync();

      ctx.address = usedRange.address;
      ctx.values = usedRange.values as unknown[][];
      ctx.data = usedRange.values as unknown[][];
      ctx.rowCount = usedRange.rowCount;
      ctx.columnCount = usedRange.columnCount;
    }

    return ctx;
  });
}

/**
 * Proporciona el contexto reactivo de Excel para el add-in.
 *
 * - Se refresca automáticamente cuando el usuario cambia de hoja (onActivated)
 *   o edita datos (onChanged, con debounce de 400 ms).
 * - getContextForMessage() lee Excel en vivo justo antes de enviar un mensaje,
 *   garantizando el contexto más reciente sin depender del ciclo de render.
 */
export function useExcelContext(): UseExcelContextResult {
  const [excelContext, setExcelContext] = useState<ExcelContext>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Ref con el último contexto conocido — actualizado sincrónicamente en applyContext.
  const contextRef = useRef<ExcelContext>({});
  const debounceRef = useRef<number | null>(null);

  const applyContext = useCallback((ctx: ExcelContext) => {
    contextRef.current = ctx;
    setExcelContext(ctx);
  }, []);

  const refresh = useCallback(async () => {
    if (typeof Excel === "undefined") {
      applyContext({});
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const ctx = await readExcelContext();
      applyContext(ctx);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [applyContext]);

  /** Llama a esto justo antes de cada mensaje para obtener el contexto más fresco. */
  const getContextForMessage = useCallback(async (): Promise<ExcelContext> => {
    try {
      const ctx = await readExcelContext();
      applyContext(ctx);
      return ctx;
    } catch {
      // Si Excel no responde, devolvemos el último contexto conocido del ref.
      return contextRef.current;
    }
  }, [applyContext]);

  // Lectura inicial al montar el componente.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Refrescar cuando el task pane vuelve a ser visible.
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [refresh]);

  // Registrar listeners de Office.js (onActivated + onChanged) una sola vez al montar.
  useEffect(() => {
    if (typeof Excel === "undefined") return;

    let mounted = true;

    const scheduleRefresh = () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        if (mounted) void refresh();
      }, CHANGE_DEBOUNCE_MS);
    };

    Excel.run(async (context) => {
      // Cambio de hoja activa → actualizar contexto inmediatamente (sin debounce).
      context.workbook.worksheets.onActivated.add(async () => {
        if (mounted) void refresh();
      });

      // Edición de datos en cualquier hoja → actualizar con debounce.
      context.workbook.worksheets.onChanged.add(async () => {
        if (mounted) scheduleRefresh();
      });

      await context.sync();
    }).catch(() => {
      // Office.js no disponible o error al registrar listeners; no es crítico.
    });

    return () => {
      mounted = false;
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [refresh]);

  return { excelContext, getContextForMessage, isLoading, error, refresh };
}
