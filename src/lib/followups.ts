/**
 * Extrae las sugerencias del array de anotaciones del mensaje (AI SDK v4).
 * El backend las envía como: dataStream.writeData({ type: "followups", suggestions: [...] })
 */
export function extractFollowups(
  annotations: unknown[] | undefined
): string[] {
  if (!Array.isArray(annotations)) return [];
  for (const ann of annotations) {
    if (
      ann &&
      typeof ann === "object" &&
      "type" in ann &&
      (ann as { type: unknown }).type === "followups" &&
      "suggestions" in ann &&
      Array.isArray((ann as { suggestions: unknown }).suggestions)
    ) {
      return (ann as { suggestions: unknown[] }).suggestions
        .filter((s): s is string => typeof s === "string");
    }
  }
  return [];
}
