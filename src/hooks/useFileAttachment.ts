import { useCallback, useState } from "react";
import type { AttachmentPayload } from "@/lib/assistant";

const FREE_MAX_FILES = 1;
const FREE_MAX_MB = 5;
const PRO_MAX_FILES = 5;
const PRO_MAX_MB = 20;
const BYTES_PER_MB = 1024 * 1024;

export type Tier = "free" | "pro";

type FileEntry = {
  id: string;
  file: File;
  base64: string;
  mimeType: string;
  filename: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64 ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export type UseFileAttachmentResult = {
  files: FileEntry[];
  addFiles: (fileList: FileList | File[]) => void;
  removeFile: (id: string) => void;
  clear: () => void;
  error: string | null;
  getAttachmentForRequest: () => AttachmentPayload | null;
  maxFiles: number;
  maxBytesPerFile: number;
};

/**
 * Estado para adjuntos (PDF/imágenes). Free: 1 archivo ≤5MB; Pro: 5 archivos ≤20MB.
 * Convierte a base64 para enviar en POST /api/chat. No se sube a ningún otro servicio.
 */
export function useFileAttachment(tier: Tier = "free"): UseFileAttachmentResult {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const maxFiles = tier === "pro" ? PRO_MAX_FILES : FREE_MAX_FILES;
  const maxBytesPerFile = (tier === "pro" ? PRO_MAX_MB : FREE_MAX_MB) * BYTES_PER_MB;

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      setError(null);
      const list = Array.isArray(fileList) ? fileList : Array.from(fileList);
      const toAdd: FileEntry[] = [];
      for (const file of list) {
        if (files.length + toAdd.length >= maxFiles) {
          setError(`Máximo ${maxFiles} archivo(s) (${tier}).`);
          break;
        }
        if (file.size > maxBytesPerFile) {
          const mb = maxBytesPerFile / BYTES_PER_MB;
          setError(`Cada archivo debe ser ≤${mb}MB (${tier}).`);
          break;
        }
        toAdd.push({
          id: `${file.name}-${file.size}-${Date.now()}`,
          file,
          base64: "",
          mimeType: file.type || "application/octet-stream",
          filename: file.name,
        });
      }
      if (toAdd.length === 0) return;
      Promise.all(
        toAdd.map(async (entry) => ({
          ...entry,
          base64: await fileToBase64(entry.file),
        }))
      ).then((resolved) => {
        setFiles((prev) => [...prev, ...resolved]);
      });
    },
    [files.length, maxFiles, maxBytesPerFile, tier]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  const getAttachmentForRequest = useCallback((): AttachmentPayload | null => {
    const first = files[0];
    if (!first || !first.base64) return null;
    return {
      base64: first.base64,
      mimeType: first.mimeType,
      filename: first.filename,
    };
  }, [files]);

  return {
    files,
    addFiles,
    removeFile,
    clear,
    error,
    getAttachmentForRequest,
    maxFiles,
    maxBytesPerFile,
  };
}
