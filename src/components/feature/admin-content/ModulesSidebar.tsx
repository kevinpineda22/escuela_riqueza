import { useState, useMemo } from "react";
import { Search, Plus, ArrowUp, ArrowDown, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Module, Lesson } from "@/lib/api/stream/content";

interface ModulesSidebarProps {
  modules: Module[];
  lessonsMap: Record<string, Lesson[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onMove: (index: number, direction: "up" | "down") => void;
  reordering: boolean;
}

export const ModulesSidebar = ({
  modules,
  lessonsMap,
  selectedId,
  onSelect,
  onCreate,
  onMove,
  reordering,
}: ModulesSidebarProps) => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return modules.map((m, i) => ({ mod: m, originalIndex: i }));
    return modules
      .map((m, i) => ({ mod: m, originalIndex: i }))
      .filter(({ mod }) => mod.title.toLowerCase().includes(q));
  }, [modules, query]);

  return (
    <aside className="w-full lg:w-[320px] lg:shrink-0 flex flex-col bg-surface-page/40 border border-ink/5 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-ink/5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground-strong">Módulos</h2>
            <p className="text-xs text-foreground-muted">{modules.length} en total</p>
          </div>
          <button
            onClick={onCreate}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand hover:bg-brand-hover text-black text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} />
            Nuevo
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar módulo..."
            className="w-full bg-black/40 border border-line-subtle rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-strong placeholder:text-fg-30 outline-none focus:border-brand/40 focus:ring-1 focus:ring-focus/20 transition-colors light:bg-surface-input light:border-line-control/50 light:placeholder:text-foreground-placeholder"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 max-h-[calc(100vh-280px)] lg:max-h-none">
        {filtered.length === 0 && query && (
          <p className="text-center text-sm text-foreground-muted py-8">Sin resultados</p>
        )}
        {filtered.length === 0 && !query && (
          <div className="text-center py-10 px-4">
            <LayoutGrid size={28} className="mx-auto text-fg-15 mb-3" />
            <p className="text-sm text-foreground-muted">Aún no hay módulos.</p>
            <button
              onClick={onCreate}
              className="mt-3 text-xs text-accent hover:text-accent-hover font-semibold"
            >
              Crear el primero →
            </button>
          </div>
        )}

        {filtered.map(({ mod, originalIndex }) => {
          const isActive = mod.id === selectedId;
          const lessonCount = lessonsMap[mod.id]?.length || 0;

          return (
            <button
              key={mod.id}
              onClick={() => onSelect(mod.id)}
              className={cn(
                "group w-full text-left px-3 py-3 rounded-xl border transition-all flex items-start gap-3",
                isActive
                  ? "bg-brand/10 border-brand/30"
                  : "bg-transparent border-transparent hover:bg-ink/[0.03] hover:border-ink/5"
              )}
            >
              <span
                className={cn(
                  "shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono",
                  isActive ? "bg-brand text-black" : "bg-ink/5 text-fg-40"
                )}
              >
                {String(originalIndex + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p
                    className={cn(
                      "text-sm font-semibold truncate min-w-0",
                      isActive ? "text-foreground-strong" : "text-fg-80"
                    )}
                  >
                    {mod.title}
                  </p>
                  {!mod.is_published && (
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider bg-ink/5 text-fg-50 px-1.5 py-0.5 rounded">
                      Borrador
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground-muted">
                  {lessonCount} {lessonCount === 1 ? "lección" : "lecciones"}
                </p>
              </div>

              {!query && (
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(originalIndex, "up");
                    }}
                    disabled={originalIndex === 0 || reordering}
                    className="p-0.5 text-fg-40 hover:text-accent disabled:opacity-20 disabled:hover:text-fg-40 transition-colors"
                    aria-label="Subir módulo"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(originalIndex, "down");
                    }}
                    disabled={originalIndex === modules.length - 1 || reordering}
                    className="p-0.5 text-fg-40 hover:text-accent disabled:opacity-20 disabled:hover:text-fg-40 transition-colors"
                    aria-label="Bajar módulo"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
};
