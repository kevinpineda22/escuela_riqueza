import { motion } from "motion/react";
import { MessageSquare, Pin, Trash2 } from "lucide-react";
import type { CommunityPost } from "@/lib/api/community";
import { LikeButton } from "./LikeButton";
import { authorInitials, authorName, categoryMeta, formatRelative } from "./community-utils";
import { cn } from "@/lib/utils";

interface PostCardProps {
  post: CommunityPost;
  canDelete: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

export function PostCard({ post, canDelete, onOpen, onDelete }: PostCardProps) {
  const cat = categoryMeta(post.category);
  const CatIcon = cat.icon;
  const isAdmin = post.author?.role === "admin";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      whileHover={{ y: -2 }}
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.015] p-5 transition-all duration-300 hover:border-gold/40 hover:shadow-[0_8px_32px_-12px_rgba(204,164,59,0.35)]"
    >
      {/* glow accent on hover */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-gold/[0.06] via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      {post.is_pinned && (
        <div className="pointer-events-none absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      )}

      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full bg-gold/30 blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="relative h-11 w-11 overflow-hidden rounded-full bg-gradient-to-br from-gold/25 to-gold/5 ring-2 ring-gold/30 flex items-center justify-center text-gold font-bold">
            {post.author?.avatar_url ? (
              <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              authorInitials(post.author)
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-textMuted">
            <span className="font-semibold text-white/90">{authorName(post.author)}</span>
            {isAdmin && (
              <span className="rounded bg-gradient-to-r from-gold/30 to-gold/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold ring-1 ring-gold/30">
                Admin
              </span>
            )}
            <span className="text-white/20">·</span>
            <span>{formatRelative(post.created_at)}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border bg-gradient-to-r px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                cat.chip
              )}
            >
              <CatIcon size={10} />
              {cat.label}
            </span>
            {post.is_pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">
                <Pin size={10} /> Fijado
              </span>
            )}
          </div>

          <h3 className="mb-2 line-clamp-2 text-lg font-bold text-white transition-colors group-hover:text-gold sm:text-xl">
            {post.title}
          </h3>

          <p className="line-clamp-2 text-sm leading-relaxed text-textMuted">{post.body}</p>

          <div className="mt-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <LikeButton
              targetType="post"
              targetId={post.id}
              liked={post.liked_by_me ?? false}
              count={post.like_count}
              size="sm"
            />
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1 text-xs text-textMuted ring-1 ring-white/5 transition-colors group-hover:bg-white/10 group-hover:text-white">
              <MessageSquare size={14} />
              <span className="font-semibold tabular-nums">{post.comment_count}</span>
            </div>
            {canDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-red-400 opacity-0 ring-1 ring-transparent transition-all duration-200 hover:bg-red-500/10 hover:text-red-300 hover:ring-red-500/20 group-hover:opacity-100"
                aria-label="Eliminar publicación"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
