import { useEffect, useRef } from "react";
import type { Message } from "ai/react";
import {
  TOOL_READ_EXCEL_RANGE,
  TOOL_LIST_SHEETS,
  TOOL_NAVIGATE_TO_CELL,
  TOOL_HIGHLIGHT_CELLS,
  parseReadRangeArgs,
  parseNavigateToCellArgs,
  parseHighlightCellsArgs,
} from "@/lib/toolCalls";

type AddToolResultFn = (params: { toolCallId: string; result: unknown }) => void;

/**
 * Ejecuta automáticamente las tools de solo lectura/navegación cuando llegan
 * con state="call", sin requerir confirmación del usuario.
 *
 * Tools gestionadas: read_excel_range, list_sheets, navigate_to_cell, highlight_cells.
 */
export function useExcelToolAutoExecution(
  messages: Message[],
  addToolResult: AddToolResultFn
): void {
  const executedAutoToolsRef = useRef(new Set<string>());

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      const invocations = msg.toolInvocations;
      if (!Array.isArray(invocations)) continue;

      for (const inv of invocations) {
        if (inv.state !== "call") continue;

        const { toolCallId, toolName } = inv as {
          toolCallId: string;
          toolName: string;
          args?: unknown;
        };
        if (executedAutoToolsRef.current.has(toolCallId)) continue;

        // ── read_excel_range ──────────────────────────────────────────────────
        if (toolName === TOOL_READ_EXCEL_RANGE) {
          executedAutoToolsRef.current.add(toolCallId);
          const { range } = parseReadRangeArgs(inv.args);

          if (!range) {
            addToolResult({ toolCallId, result: { error: "No se especificó un rango." } });
            continue;
          }
          if (typeof Excel === "undefined") {
            addToolResult({ toolCallId, result: { error: "Excel no disponible." } });
            continue;
          }

          let sheetId: string | undefined;
          let rangeAddr = range;
          if (range.includes("!")) {
            const idx = range.indexOf("!");
            sheetId = range.slice(0, idx).replace(/'/g, "");
            rangeAddr = range.slice(idx + 1);
          }

          void Excel.run(async (context) => {
            const sheet = sheetId
              ? context.workbook.worksheets.getItem(sheetId)
              : context.workbook.worksheets.getActiveWorksheet();
            const r = sheet.getRange(rangeAddr);
            r.load(["address", "values", "rowCount", "columnCount"]);
            await context.sync();
            addToolResult({
              toolCallId,
              result: {
                address: r.address,
                values: r.values,
                rowCount: r.rowCount,
                columnCount: r.columnCount,
              },
            });
          }).catch((e: unknown) => {
            addToolResult({
              toolCallId,
              result: { error: e instanceof Error ? e.message : String(e) },
            });
          });
        }

        // ── list_sheets ───────────────────────────────────────────────────────
        else if (toolName === TOOL_LIST_SHEETS) {
          executedAutoToolsRef.current.add(toolCallId);
          if (typeof Excel === "undefined") {
            addToolResult({ toolCallId, result: { error: "Excel no disponible." } });
            continue;
          }
          void Excel.run(async (context) => {
            const sheets = context.workbook.worksheets;
            sheets.load("name");
            await context.sync();
            addToolResult({
              toolCallId,
              result: { sheets: sheets.items.map((s) => s.name) },
            });
          }).catch((e: unknown) => {
            addToolResult({
              toolCallId,
              result: { error: e instanceof Error ? e.message : String(e) },
            });
          });
        }

        // ── navigate_to_cell ──────────────────────────────────────────────────
        else if (toolName === TOOL_NAVIGATE_TO_CELL) {
          executedAutoToolsRef.current.add(toolCallId);
          const { range, sheetName } = parseNavigateToCellArgs(inv.args);

          if (!range) {
            addToolResult({ toolCallId, result: { error: "No se especificó un rango." } });
            continue;
          }
          if (typeof Excel === "undefined") {
            addToolResult({ toolCallId, result: { error: "Excel no disponible." } });
            continue;
          }

          void Excel.run(async (context) => {
            const sheet = sheetName
              ? context.workbook.worksheets.getItem(sheetName)
              : context.workbook.worksheets.getActiveWorksheet();
            const r = sheet.getRange(
              range.includes("!") ? range.slice(range.indexOf("!") + 1) : range
            );
            r.select();
            await context.sync();
            addToolResult({ toolCallId, result: { success: true } });
          }).catch((e: unknown) => {
            addToolResult({
              toolCallId,
              result: { error: e instanceof Error ? e.message : String(e) },
            });
          });
        }

        // ── highlight_cells ───────────────────────────────────────────────────
        else if (toolName === TOOL_HIGHLIGHT_CELLS) {
          executedAutoToolsRef.current.add(toolCallId);
          const { range, sheetName, color = "#FFFF00" } = parseHighlightCellsArgs(inv.args);

          if (!range) {
            addToolResult({ toolCallId, result: { error: "No se especificó un rango." } });
            continue;
          }
          if (typeof Excel === "undefined") {
            addToolResult({ toolCallId, result: { error: "Excel no disponible." } });
            continue;
          }

          void Excel.run(async (context) => {
            const sheet = sheetName
              ? context.workbook.worksheets.getItem(sheetName)
              : context.workbook.worksheets.getActiveWorksheet();
            const r = sheet.getRange(
              range.includes("!") ? range.slice(range.indexOf("!") + 1) : range
            );
            r.format.fill.color = color;
            await context.sync();
            addToolResult({ toolCallId, result: { success: true } });
          }).catch((e: unknown) => {
            addToolResult({
              toolCallId,
              result: { error: e instanceof Error ? e.message : String(e) },
            });
          });
        }
      }
    }
  }, [messages, addToolResult]);
}
