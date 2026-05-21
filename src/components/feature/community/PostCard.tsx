import { useState } from "react";
import { motion } from "motion/react";
import { MessageSquare, MoreHorizontal, Pin, PinOff, Shield, Trash2 } from "lucide-react";
import type { CommunityPost } from "@/lib/api/community";
import { togglePinPost } from "@/lib/api/community";
import { toast } from "@/components/ui/toaster";
import { LikeButton } from "./LikeButton";
import { authorInitials, authorName, categoryMeta, formatRelative } from "./community-utils";
import { cn } from "@/lib/utils";

interface PostCardProps {
  post: CommunityPost;
  canDelete: boolean;
  isAdmin?: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onPinChanged?: (post: CommunityPost) => void;
}

const PREVIEW_LIMIT = 280;

export function PostCard({ post, canDelete, isAdmin, onOpen, onDelete, onPinChanged }: PostCardProps) {
  const cat = categoryMeta(post.category);
  const CatIcon = cat.icon;
  const isAuthorAdmin = post.author?.role === "admin";
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const tooLong = post.body.length > PREVIEW_LIMIT;
  const displayBody = expanded || !tooLong ? post.body : post.body.slice(0, PREVIEW_LIMIT) + "…";

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinning) return;
    setMenuOpen(false);
    setPinning(true);
    try {
      await togglePinPost(post.id, !post.is_pinned);
      toast.success(post.is_pinned ? "Publicación desfijada" : "Publicación fijada");
      onPinChanged?.({ ...post, is_pinned: !post.is_pinned });
    } catch (err) {
      console.error(err);
      toast.error("No se pudo actualizar");
    } finally {
      setPinning(false);
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      onClick={onOpen}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border bg-darker/60 transition-all duration-300",
        post.is_pinned
          ? "border-gold/40 shadow-[0_8px_32px_-16px_rgba(204,164,59,0.45)] hover:border-gold/60"
          : "border-white/10 hover:border-white/20 hover:bg-darker/80"
      )}
    >
      {post.is_pinned && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
      )}

      <div className="flex gap-3 p-5 sm:gap-4">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={cn(
            "relative h-12 w-12 overflow-hidden rounded-full flex items-center justify-center text-base font-bold ring-2 transition-all",
            isAuthorAdmin
              ? "bg-gradient-to-br from-gold/30 to-gold/10 text-gold ring-gold/50"
              : "bg-gradient-to-br from-white/15 to-white/5 text-white/90 ring-white/10 group-hover:ring-white/20"
          )}>
            {post.author?.avatar_url ? (
              <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              authorInitials(post.author)
            )}
          </div>
          {isAuthorAdmin && (
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold ring-2 ring-darker">
              <Shield size={10} className="text-darker" strokeWidth={3} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Author line */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <span className="font-semibold text-white truncate">{authorName(post.author)}</span>
                {isAuthorAdmin && (
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold ring-1 ring-gold/30">
                    Admin
                  </span>
                )}
                <span className="text-xs text-textMuted">· {formatRelative(post.created_at)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-gold ring-1 ring-gold/30">
                    <Pin size={10} /> Fijado
                  </span>
                )}
              </div>
            </div>

            {/* Actions menu */}
            {(isAdmin || canDelete) && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="rounded-full p-1.5 text-textMuted opacity-60 transition-all hover:bg-white/10 hover:text-white group-hover:opacity-100"
                  aria-label="Más opciones"
                >
                  <MoreHorizontal size={18} />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-darker/95 shadow-2xl backdrop-blur-xl">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={handleTogglePin}
                          disabled={pinning}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white transition-colors hover:bg-gold/10 hover:text-gold disabled:opacity-50"
                        >
                          {post.is_pinned ? <PinOff size={15} /> : <Pin size={15} />}
                          {post.is_pinned ? "Desfijar publicación" : "Fijar publicación"}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(false);
                            onDelete();
                          }}
                          className="flex w-full items-center gap-2 border-t border-white/5 px-3 py-2.5 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 size={15} />
                          Eliminar
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <h3 className="mt-2.5 text-lg font-bold leading-snug text-white transition-colors group-hover:text-gold sm:text-xl">
            {post.title}
          </h3>

          {/* Body */}
          <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-textMain/90">
            {displayBody}
          </p>
          {tooLong && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="mt-1 text-xs font-semibold text-gold hover:text-goldHover"
            >
              {expanded ? "Ver menos" : "Ver más"}
            </button>
          )}

          {/* Image */}
          {post.image_url && (
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
              <img
                src={post.image_url}
                alt="Adjunto"
                className="max-h-[480px] w-full object-contain transition-transform duration-700 group-hover:scale-[1.01]"
              />
            </div>
          )}

          {/* Actions bar */}
          <div className="mt-4 flex items-center gap-1 border-t border-white/5 pt-3" onClick={(e) => e.stopPropagation()}>
            <LikeButton
              targetType="post"
              targetId={post.id}
              liked={post.liked_by_me ?? false}
              count={post.like_count}
              size="sm"
            />
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-textMuted transition-colors hover:bg-white/5 hover:text-white"
            >
              <MessageSquare size={14} />
              <span className="tabular-nums">{post.comment_count}</span>
              <span className="hidden sm:inline">
                {post.comment_count === 1 ? "Comentario" : "Comentarios"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
