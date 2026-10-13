import type { LucideIcon } from "lucide-react";
import { HelpCircle, MessageCircle, BookOpen, Sparkles } from "lucide-react";
import type { CommunityAuthor, CommunityCategory, CommunityComment } from "@/lib/api/community";

export interface CategoryMeta {
  id: CommunityCategory;
  label: string;
  color: string;
  chip: string;
  icon: LucideIcon;
  accent: string;
}

// Cada categoría conserva su color en ambos temas: en claro usa su familia
// semántica (info / violet / success), con contraste medido en index.css.
export const CATEGORIES: CategoryMeta[] = [
  {
    id: "pregunta",
    label: "Pregunta",
    color: "bg-blue-500/15 text-blue-300 border-blue-500/30 light:bg-info-surface light:text-info light:border-info-line",
    chip: "from-blue-500/20 to-blue-500/5 text-blue-200 border-blue-400/40 light:from-info-surface light:to-surface-panel light:text-info light:border-info-line",
    icon: HelpCircle,
    accent: "shadow-[0_0_24px_rgba(59,130,246,0.18)]",
  },
  {
    id: "discusion",
    label: "Discusión",
    color: "bg-purple-500/15 text-purple-300 border-purple-500/30 light:bg-violet-surface light:text-violet light:border-violet-line",
    chip: "from-purple-500/20 to-purple-500/5 text-purple-200 border-purple-400/40 light:from-violet-surface light:to-surface-panel light:text-violet light:border-violet-line",
    icon: MessageCircle,
    accent: "shadow-[0_0_24px_rgba(168,85,247,0.18)]",
  },
  {
    id: "recurso",
    label: "Recurso",
    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 light:bg-success-surface light:text-success light:border-success-line",
    chip: "from-emerald-500/20 to-emerald-500/5 text-emerald-200 border-emerald-400/40 light:from-success-surface light:to-surface-panel light:text-success light:border-success-line",
    icon: BookOpen,
    accent: "shadow-[0_0_24px_rgba(16,185,129,0.18)]",
  },
  {
    id: "otro",
    label: "Otro",
    color: "bg-ink/5 text-foreground-muted border-line-subtle",
    chip: "from-white/10 to-white/5 text-fg-80 border-ink/15 light:from-surface-subtle light:to-surface-panel",
    icon: Sparkles,
    accent: "shadow-[0_0_24px_rgba(255,255,255,0.06)]",
  },
];

export function categoryMeta(id: CommunityCategory): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[3];
}

export function authorInitials(author: CommunityAuthor | null): string {
  const name = author?.full_name?.trim() || "Usuario";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function authorName(author: CommunityAuthor | null): string {
  return author?.full_name?.trim() || "Usuario";
}

export function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Une la lista recién traída con la que ya estaba a la vista. Un comentario
 * propio agregado localmente después de que salió el pedido no viene en la
 * respuesta: se conserva si es más nuevo que lo último que trajo el servidor.
 * Sin duplicados por id.
 */
export function mergeComments(fetched: CommunityComment[], current: CommunityComment[]): CommunityComment[] {
  const ids = new Set(fetched.map((c) => c.id));
  const newest = fetched.reduce((max, c) => (c.created_at > max ? c.created_at : max), "");
  const localOnly = current.filter((c) => !ids.has(c.id) && c.created_at > newest);
  return [...fetched, ...localOnly];
}
