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
  const isAdmin = post.author?.role === "admin";

  return (
    <article
      className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-gold/30 rounded-2xl p-5 transition-all cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-11 h-11 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold font-bold overflow-hidden">
          {post.author?.avatar_url ? (
            <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            authorInitials(post.author)
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-textMuted mb-1.5">
            <span className="text-white/90 font-semibold">{authorName(post.author)}</span>
            {isAdmin && (
              <span className="px-1.5 py-0.5 rounded bg-gold/15 text-gold text-[10px] font-bold uppercase tracking-wide">
                Admin
              </span>
            )}
            <span>·</span>
            <span>{formatRelative(post.created_at)}</span>
            <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide", cat.color)}>
              {cat.label}
            </span>
            {post.is_pinned && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 text-gold text-[10px] font-bold uppercase">
                <Pin size={10} /> Fijado
              </span>
            )}
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-gold transition-colors">
            {post.title}
          </h3>

          <p className="text-sm text-textMuted line-clamp-2 leading-relaxed">{post.body}</p>

          <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
            <LikeButton
              targetType="post"
              targetId={post.id}
              liked={post.liked_by_me ?? false}
              count={post.like_count}
              size="sm"
            />
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 text-textMuted text-xs">
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
                className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                aria-label="Eliminar publicación"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
