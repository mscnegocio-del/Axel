import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import type { Tier } from "@/hooks/useFileAttachment";

export type TokenUsageState = {
  tokensUsed: number;
  limit: number;
  isLoading: boolean;
  error: Error | null;
  limitExceeded: boolean;
  tier: Tier;
  refetch: () => Promise<void>;
};

/** Respuesta esperada del GET /api/usage (ajustar si el backend usa otros nombres). */
type UsageResponse = {
  tokens_used?: number;
  tokensUsed?: number;
  limit?: number;
  tier?: Tier;
};

/** Límite Free = 50_000. Si limit es mayor o 0 (sin límite estricto), inferir Pro. */
function inferTier(tierFromApi: Tier | undefined, limit: number): Tier {
  if (tierFromApi === "pro" || tierFromApi === "free") return tierFromApi;
  if (limit === 0 || limit > 100_000) return "pro";
  return "free";
}

export function useTokenUsage(): TokenUsageState {
  const [tokensUsed, setTokensUsed] = useState(0);
  const [limit, setLimit] = useState(0);
  const [tier, setTier] = useState<Tier>("free");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [limitExceededByBackend, setLimitExceededByBackend] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("usage");
      if (res.status === 429) {
        setLimitExceededByBackend(true);
        setError(new Error("Límite de uso alcanzado"));
        return;
      }
      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }
      const data = (await res.json()) as UsageResponse;
      const used = data.tokens_used ?? data.tokensUsed ?? 0;
      const max = data.limit ?? 50_000;
      const tier = inferTier(data.tier, max);
      setTokensUsed(used);
      setLimit(max);
      setTier(tier);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const limitExceeded =
    limitExceededByBackend || (limit > 0 && tokensUsed >= limit);

  return {
    tokensUsed,
    limit,
    isLoading,
    error,
    limitExceeded,
    tier,
    refetch,
  };
}
