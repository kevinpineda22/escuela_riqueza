import { useState } from "react";
import { motion } from "motion/react";
import { MessageSquare, MoreHorizontal, Pin, PinOff, Trash2 } from "lucide-react";
import type { CommunityPost } from "@/lib/api/community";
import { togglePinPost } from "@/lib/api/community";
import { toast } from "@/components/ui/toaster";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LikeButton } from "./LikeButton";
import { AuthorAvatar } from "./AuthorAvatar";
import { authorName, categoryMeta, formatRelative } from "./community-utils";
import { cn } from "@/lib/utils";

interface PostCardProps {
  post: CommunityPost;
  canDelete: boolean;
  isAdmin?: boolean;
  canWrite: boolean;
  onOpen: () => void;
  /** Abre la publicación directo en sus comentarios. */
  onOpenComments?: () => void;
  onDelete: () => void;
  onPinChanged?: (post: CommunityPost) => void;
}

const PREVIEW_LIMIT = 280;

export function PostCard({ post, canDelete, isAdmin, canWrite, onOpen, onOpenComments, onDelete, onPinChanged }: PostCardProps) {
  const cat = categoryMeta(post.category);
  const CatIcon = cat.icon;
  const isAuthorAdmin = post.author?.role === "admin";
  const [pinning, setPinning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const tooLong = post.body.length > PREVIEW_LIMIT;
  const displayBody = expanded || !tooLong ? post.body : post.body.slice(0, PREVIEW_LIMIT) + "…";

  const handleTogglePin = async () => {
    if (pinning) return;
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
      // Con el mouse toda la tarjeta abre. Con teclado y lector de pantalla
      // abre el título (un botón real): un <article> clickeable no se enfoca.
      onClick={onOpen}
      aria-labelledby={`post-title-${post.id}`}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border bg-surface-page/60 light:bg-surface-panel light:shadow-panel transition-all duration-300 focus-within:border-brand/50",
        post.is_pinned
          ? "border-brand/40 shadow-[0_8px_32px_-16px_rgba(204,164,59,0.45)] hover:border-brand/60"
          : "border-line-subtle hover:border-ink/20 hover:bg-surface-page/80 light:hover:bg-surface-panel"
      )}
    >
      {post.is_pinned && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-brand to-transparent" />
      )}

      <div className="flex gap-3 p-5 sm:gap-4">
        <AuthorAvatar author={post.author} size="lg" />

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Author line */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <span className="font-semibold text-foreground-strong truncate">{authorName(post.author)}</span>
                {isAuthorAdmin && (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent ring-1 ring-focus/30">
                    Admin
                  </span>
                )}
                <span className="text-xs text-foreground-muted">· {formatRelative(post.created_at)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border bg-gradient-to-r px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    cat.chip
                  )}
                >
                  <CatIcon size={10} aria-hidden />
                  {cat.label}
                </span>
                {post.is_pinned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase text-accent ring-1 ring-focus/30">
                    <Pin size={10} aria-hidden /> Fijado
                  </span>
                )}
              </div>
            </div>

            {/* Acciones: menú de Radix (Escape, flechas y foco de vuelta al
                botón). El de antes era un div propio sin teclado. */}
            {(isAdmin || canDelete) && (
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="-m-1.5 inline-flex size-11 items-center justify-center rounded-full text-foreground-muted transition-all hover:bg-ink/10 hover:text-foreground-strong data-[state=open]:bg-ink/10 data-[state=open]:text-foreground-strong"
                      aria-label="Más opciones de la publicación"
                    >
                      <MoreHorizontal size={18} aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[13rem]">
                    {isAdmin && (
                      <DropdownMenuItem onSelect={handleTogglePin} disabled={pinning} className="cursor-pointer gap-2">
                        {post.is_pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />}
                        {post.is_pinned ? "Desfijar publicación" : "Fijar publicación"}
                      </DropdownMenuItem>
                    )}
                    {isAdmin && canDelete && <DropdownMenuSeparator />}
                    {canDelete && (
                      <DropdownMenuItem onSelect={onDelete} className="cursor-pointer gap-2 text-danger focus:text-danger">
                        <Trash2 size={15} aria-hidden />
                        Eliminar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Title */}
          <h3 id={`post-title-${post.id}`} className="mt-2.5 text-lg font-bold leading-snug text-foreground-strong transition-colors group-hover:text-accent sm:text-xl">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
            >
              {post.title}
            </button>
          </h3>

          {/* Body */}
          <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
            {displayBody}
          </p>
          {tooLong && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              aria-expanded={expanded}
              className="mt-1 text-xs font-semibold text-accent hover:text-accent-hover"
            >
              {expanded ? "Ver menos" : "Ver más"}
            </button>
          )}

          {/* Image: el fondo negro es el lienzo de la imagen, en ambos temas. */}
          {post.image_url && (
            <div className="mt-3 overflow-hidden rounded-xl border border-line-subtle bg-black">
              <img
                src={post.image_url}
                alt={`Imagen adjunta a «${post.title}»`}
                loading="lazy"
                className="max-h-[480px] w-full object-contain transition-transform duration-700 group-hover:scale-[1.01]"
              />
            </div>
          )}

          {/* Actions bar */}
          <div className="mt-4 flex items-center gap-1 border-t border-ink/5 pt-3" onClick={(e) => e.stopPropagation()}>
            <LikeButton
              targetType="post"
              targetId={post.id}
              liked={post.liked_by_me ?? false}
              count={post.like_count}
              size="sm"
              readOnly={!canWrite}
            />
            <button
              type="button"
              onClick={onOpenComments ?? onOpen}
              aria-label={`${post.comment_count} ${post.comment_count === 1 ? "comentario" : "comentarios"}: ver los comentarios`}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-foreground-muted transition-colors hover:bg-ink/5 hover:text-foreground-strong"
            >
              <MessageSquare size={14} aria-hidden />
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
