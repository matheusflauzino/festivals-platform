export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between border-t border-border px-5 py-3">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        Anterior
      </button>
      <span className="text-sm text-text-muted">
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        Próxima
      </button>
    </nav>
  );
}
