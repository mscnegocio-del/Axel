import { useState } from "react";

/**
 * Estado local del modelo seleccionado en la UI.
 * Si el backend acepta un parámetro de modelo, se puede enviar en el body del chat.
 * Por ahora es solo estado local (placeholder).
 */
export function useModelSelector(initialModelId: string = "default") {
  const [modelId, setModelId] = useState(initialModelId);
  return {
    modelId,
    setModelId,
  };
}
