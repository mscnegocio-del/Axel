type TokenUsageDisplayProps = {
  tokensUsed: number;
  limit: number;
  isLoading?: boolean;
  onUpgradeClick?: () => void;
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function TokenUsageDisplay({
  tokensUsed,
  limit,
  isLoading,
  onUpgradeClick,
}: TokenUsageDisplayProps) {
  if (isLoading) {
    return <span className="text-muted-foreground text-xs">…</span>;
  }
  const hasLimit = limit > 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">
        {formatTokens(tokensUsed)}
        {hasLimit ? ` / ${formatTokens(limit)}` : ""} tokens
      </span>
      {onUpgradeClick && (
        <button
          type="button"
          onClick={onUpgradeClick}
          className="text-primary hover:underline"
        >
          Mejorar plan
        </button>
      )}
    </div>
  );
}
