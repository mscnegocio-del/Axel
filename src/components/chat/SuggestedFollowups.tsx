type SuggestedFollowupsProps = {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
};

/**
 * Botones de seguimiento sugerido que aparecen debajo del último mensaje del asistente.
 * Las sugerencias llegan via message.annotations del stream (AI SDK v4 data annotations).
 */
export function SuggestedFollowups({ suggestions, onSelect }: SuggestedFollowupsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="mr-8 flex flex-col gap-1">
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(s)}
          className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

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
