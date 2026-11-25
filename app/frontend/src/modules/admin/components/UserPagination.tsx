export default function UserPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (updater: (page: number) => number) => void;
}) {
  return (
    <div className="flex justify-center gap-2 mt-4">
      <button
        disabled={page === 1}
        onClick={() => onPageChange(p => p - 1)}
        className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-50 dark:text-slate-300"
      >
        Anterior
      </button>
      <span className="px-3 py-1 text-sm font-bold dark:text-slate-300">Página {page} de {totalPages}</span>
      <button
        disabled={page === totalPages}
        onClick={() => onPageChange(p => p + 1)}
        className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-50 dark:text-slate-300"
      >
        Siguiente
      </button>
    </div>
  );
}
