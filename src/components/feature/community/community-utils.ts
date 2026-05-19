import type { CommunityAuthor, CommunityCategory } from "@/lib/api/community";

export const CATEGORIES: { id: CommunityCategory; label: string; color: string }[] = [
  { id: "pregunta", label: "Pregunta", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { id: "discusion", label: "Discusión", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  { id: "recurso", label: "Recurso", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { id: "otro", label: "Otro", color: "bg-white/5 text-textMuted border-white/10" },
];

export function categoryMeta(id: CommunityCategory) {
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
