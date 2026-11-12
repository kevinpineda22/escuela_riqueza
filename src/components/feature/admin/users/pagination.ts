export const USERS_PAGE_SIZE = 20;

export interface PageSlice {
  /** Página efectiva (1-based), ya acotada a las que existen. */
  page: number;
  pageCount: number;
  /** Índices para `slice(start, end)`. */
  start: number;
  end: number;
}

/** Acota la página pedida: si un filtro deja menos resultados, nunca queda en una página vacía. */
export function pageSlice(total: number, requested: number, size = USERS_PAGE_SIZE): PageSlice {
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, Math.floor(requested) || 1), pageCount);
  const start = (page - 1) * size;
  return { page, pageCount, start, end: Math.min(start + size, total) };
}

/**
 * Números a mostrar: siempre la primera, la última y las vecinas de la actual;
 * `null` marca un salto ("…").
 */
export function pageNumbers(page: number, pageCount: number): (number | null)[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of pages) {
    const prev = out[out.length - 1];
    if (typeof prev === "number" && p - prev > 1) out.push(p - prev === 2 ? prev + 1 : null);
    out.push(p);
  }
  return out;
}
