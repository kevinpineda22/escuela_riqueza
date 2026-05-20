import type { LucideIcon } from "lucide-react";
import { HelpCircle, MessageCircle, BookOpen, Sparkles } from "lucide-react";
import type { CommunityAuthor, CommunityCategory } from "@/lib/api/community";

export interface CategoryMeta {
  id: CommunityCategory;
  label: string;
  color: string;
  chip: string;
  icon: LucideIcon;
  accent: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: "pregunta",
    label: "Pregunta",
    color: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    chip: "from-blue-500/20 to-blue-500/5 text-blue-200 border-blue-400/40",
    icon: HelpCircle,
    accent: "shadow-[0_0_24px_rgba(59,130,246,0.18)]",
  },
  {
    id: "discusion",
    label: "Discusión",
    color: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    chip: "from-purple-500/20 to-purple-500/5 text-purple-200 border-purple-400/40",
    icon: MessageCircle,
    accent: "shadow-[0_0_24px_rgba(168,85,247,0.18)]",
  },
  {
    id: "recurso",
    label: "Recurso",
    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    chip: "from-emerald-500/20 to-emerald-500/5 text-emerald-200 border-emerald-400/40",
    icon: BookOpen,
    accent: "shadow-[0_0_24px_rgba(16,185,129,0.18)]",
  },
  {
    id: "otro",
    label: "Otro",
    color: "bg-white/5 text-textMuted border-white/10",
    chip: "from-white/10 to-white/5 text-white/80 border-white/15",
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
