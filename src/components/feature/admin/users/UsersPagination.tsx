import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { pageNumbers, type PageSlice } from "./pagination";

interface UsersPaginationProps {
  slice: PageSlice;
  total: number;
  onPageChange: (page: number) => void;
}

const navButton =
  "flex items-center justify-center w-9 h-9 rounded-lg border border-line-subtle text-fg-70 hover:text-foreground-strong hover:border-brand/40 transition-colors disabled:opacity-30 disabled:pointer-events-none";

export function UsersPagination({ slice, total, onPageChange }: UsersPaginationProps) {
  const { page, pageCount, start, end } = slice;

  return (
    <div className="bg-ink/5 border-t border-line-subtle px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-sm text-foreground-muted">
        {total === 0 ? (
          "Sin usuarios"
        ) : (
          <>
            Mostrando <span className="font-bold text-foreground-strong">{start + 1}–{end}</span> de{" "}
            <span className="font-bold text-foreground-strong">{total}</span> usuarios
          </>
        )}
      </p>

      {pageCount > 1 && (
        <nav aria-label="Paginación de usuarios" className="flex items-center gap-1.5">
          <button
            type="button"
            className={navButton}
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>
          {pageNumbers(page, pageCount).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="w-6 text-center text-fg-40" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Página ${p}`}
                className={cn(
                  "min-w-9 h-9 px-2 rounded-lg text-sm font-semibold border transition-colors",
                  p === page
                    ? "bg-brand text-on-brand border-brand"
                    : "border-line-subtle text-fg-70 hover:text-foreground-strong hover:border-brand/40",
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className={navButton}
            onClick={() => onPageChange(page + 1)}
            disabled={page === pageCount}
            aria-label="Página siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
