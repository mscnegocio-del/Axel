type FileEntry = {
  id: string;
  filename: string;
};

type AttachmentListProps = {
  files: FileEntry[];
  onRemove: (id: string) => void;
  error?: string | null;
};

export function AttachmentList({ files, onRemove, error }: AttachmentListProps) {
  return (
    <>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
            >
              {f.filename}
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                className="hover:opacity-80"
                aria-label="Quitar"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}
    </>
  );
}
