import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Loader2, MessageSquare, Pin, Send, Trash2, CornerDownRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import {
  createComment,
  deleteComment,
  deletePost,
  fetchComments,
  fetchPost,
  type CommunityComment,
  type CommunityPost,
} from "@/lib/api/community";
import { LikeButton } from "./LikeButton";
import { authorInitials, authorName, categoryMeta, formatRelative } from "./community-utils";

interface PostDetailProps {
  postId: string;
  currentUserId: string;
  isAdmin: boolean;
  onBack: () => void;
  onDeleted: () => void;
}

export function PostDetail({ postId, currentUserId, isAdmin, onBack, onDeleted }: PostDetailProps) {
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [p, c] = await Promise.all([fetchPost(postId), fetchComments(postId)]);
      if (cancelled) return;
      setPost(p);
      setComments(c);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  useEffect(() => {
    const channel = supabase
      .channel(`community_post_${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_comments", filter: `post_id=eq.${postId}` },
        async () => {
          const c = await fetchComments(postId);
          setComments(c);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "community_comments", filter: `post_id=eq.${postId}` },
        (payload) => {
          const oldId = (payload.old as { id?: string }).id;
          if (oldId) setComments((prev) => prev.filter((c) => c.id !== oldId));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  const tree = useMemo(() => {
    const roots: CommunityComment[] = [];
    const childrenMap = new Map<string, CommunityComment[]>();
    for (const c of comments) {
      if (c.parent_id) {
        const arr = childrenMap.get(c.parent_id) ?? [];
        arr.push(c);
        childrenMap.set(c.parent_id, arr);
      } else {
        roots.push(c);
      }
    }
    return { roots, childrenMap };
  }, [comments]);

  const handleDeletePost = async () => {
    if (!post) return;
    if (!confirm("¿Eliminar esta publicación y todos sus comentarios?")) return;
    try {
      await deletePost(post.id);
      toast.success("Publicación eliminada");
      onDeleted();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar");
    }
  };

  const handleDeleteComment = async (id: string) => {
    if (!confirm("¿Eliminar este comentario?")) return;
    try {
      await deleteComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id));
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar el comentario");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const txt = body.trim();
    if (txt.length < 1 || submitting) return;
    setSubmitting(true);
    try {
      const comment = await createComment({
        postId,
        body: txt,
        parentId: replyTo?.parent_id ? replyTo.parent_id : replyTo?.id ?? null,
      });
      setComments((prev) => [...prev, comment]);
      setBody("");
      setReplyTo(null);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo publicar el comentario");
    } finally {
      setSubmitting(false);
    }
  };

  const startReply = (c: CommunityComment) => {
    setReplyTo(c);
    setTimeout(() => replyInputRef.current?.focus(), 50);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="py-20 text-center">
        <p className="text-textMuted">No se encontró la publicación.</p>
        <button onClick={onBack} className="mt-4 text-gold hover:underline">
          Volver al foro
        </button>
      </div>
    );
  }

  const cat = categoryMeta(post.category);
  const CatIcon = cat.icon;
  const canDeletePost = isAdmin || post.author_id === currentUserId;
  const isPostAuthorAdmin = post.author?.role === "admin";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <button
        type="button"
        onClick={onBack}
        className="group inline-flex items-center gap-2 text-sm text-textMuted transition-colors hover:text-gold"
      >
        <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
        Volver al foro
      </button>

      {/* Post hero */}
      <motion.article
        layout
        className={cn(
          "relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-6 sm:p-8",
          cat.accent
        )}
      >
        <div className="pointer-events-none absolute -top-32 -right-20 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />

        <header className="relative mb-5 flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-gold/40 blur-md opacity-60" />
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-gold/30 to-gold/5 text-base font-bold text-gold ring-2 ring-gold/40">
              {post.author?.avatar_url ? (
                <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                authorInitials(post.author)
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-textMuted">
              <span className="font-semibold text-white">{authorName(post.author)}</span>
              {isPostAuthorAdmin && (
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
          </div>
          {canDeletePost && (
            <button
              type="button"
              onClick={handleDeletePost}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          )}
        </header>

        <h2 className="relative mb-4 text-2xl font-extrabold leading-tight text-white sm:text-3xl">
          {post.title}
        </h2>
        <div className="relative whitespace-pre-wrap text-base leading-relaxed text-textMain">
          {post.body}
        </div>

        <div className="relative mt-6 flex items-center gap-2 border-t border-white/10 pt-5">
          <LikeButton
            targetType="post"
            targetId={post.id}
            liked={post.liked_by_me ?? false}
            count={post.like_count}
          />
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-sm text-textMuted ring-1 ring-white/5">
            <MessageSquare size={15} />
            <span className="font-semibold tabular-nums">{comments.length}</span>
          </div>
        </div>
      </motion.article>

      {/* Comments */}
      <section>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold ring-1 ring-gold/30">
            <MessageSquare size={14} />
          </span>
          Comentarios
          <span className="text-sm font-semibold text-textMuted">({comments.length})</span>
        </h3>

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] transition-colors focus-within:border-gold/40"
        >
          <AnimatePresence>
            {replyTo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 border-b border-gold/20 bg-gold/[0.08] px-4 py-2.5 text-xs">
                  <span className="inline-flex items-center gap-2 text-textMuted">
                    <CornerDownRight size={13} className="text-gold" />
                    Respondiendo a <strong className="text-gold">{authorName(replyTo.author)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="text-textMuted transition-colors hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <textarea
            ref={replyInputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={3}
            placeholder={replyTo ? "Escribe tu respuesta…" : "Comparte tu opinión con la comunidad…"}
            className="w-full resize-y bg-transparent px-4 py-3 text-white placeholder:text-textMuted focus:outline-none"
          />
          <div className="flex items-center justify-between border-t border-white/5 bg-black/20 px-4 py-2.5">
            <span className="text-[10px] text-textMuted/70 tabular-nums">{body.length} / 5.000</span>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.95 }}
              disabled={submitting || body.trim().length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-darker transition-colors hover:bg-goldHover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {replyTo ? "Responder" : "Comentar"}
            </motion.button>
          </div>
        </form>

        {/* Threaded list */}
        {tree.roots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
            <MessageSquare size={28} className="mx-auto mb-3 text-textMuted/40" />
            <p className="text-sm text-textMuted">Aún no hay comentarios. Sé el primero.</p>
          </div>
        ) : (
          <motion.div layout className="space-y-3">
            <AnimatePresence initial={false}>
              {tree.roots.map((c) => (
                <CommentNode
                  key={c.id}
                  comment={c}
                  replies={tree.childrenMap.get(c.id) ?? []}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onReply={startReply}
                  onDelete={handleDeleteComment}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
    </motion.div>
  );
}

interface CommentNodeProps {
  comment: CommunityComment;
  replies: CommunityComment[];
  currentUserId: string;
  isAdmin: boolean;
  onReply: (c: CommunityComment) => void;
  onDelete: (id: string) => void;
}

function CommentNode({ comment, replies, currentUserId, isAdmin, onReply, onDelete }: CommentNodeProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-colors hover:border-white/20"
    >
      <CommentBody
        comment={comment}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onReply={onReply}
        onDelete={onDelete}
      />
      {replies.length > 0 && (
        <div className="relative mt-4 space-y-3 pl-5 sm:pl-7">
          <div className="absolute left-1.5 top-0 bottom-2 w-px bg-gradient-to-b from-gold/30 via-white/10 to-transparent" />
          <AnimatePresence initial={false}>
            {replies.map((r) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="relative"
              >
                <span className="absolute -left-3.5 top-4 h-px w-3 bg-white/15" />
                <CommentBody
                  comment={r}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onReply={onReply}
                  onDelete={onDelete}
                  isReply
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

interface CommentBodyProps {
  comment: CommunityComment;
  currentUserId: string;
  isAdmin: boolean;
  onReply: (c: CommunityComment) => void;
  onDelete: (id: string) => void;
  isReply?: boolean;
}

function CommentBody({ comment, currentUserId, isAdmin, onReply, onDelete, isReply }: CommentBodyProps) {
  const canDelete = isAdmin || comment.author_id === currentUserId;
  const authorIsAdmin = comment.author?.role === "admin";

  return (
    <div className="group/comment flex items-start gap-3">
      <div className="relative shrink-0">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-gold/20 to-gold/5 text-xs font-bold text-gold ring-1 ring-gold/30">
          {comment.author?.avatar_url ? (
            <img src={comment.author.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            authorInitials(comment.author)
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-textMuted">
          <span className="font-semibold text-white/90">{authorName(comment.author)}</span>
          {authorIsAdmin && (
            <span className="rounded bg-gradient-to-r from-gold/30 to-gold/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold ring-1 ring-gold/30">
              Admin
            </span>
          )}
          <span className="text-white/20">·</span>
          <span>{formatRelative(comment.created_at)}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-textMain">{comment.body}</p>
        <div className="mt-2 flex items-center gap-1.5">
          <LikeButton
            targetType="comment"
            targetId={comment.id}
            liked={comment.liked_by_me ?? false}
            count={comment.like_count}
            size="sm"
          />
          {!isReply && (
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-textMuted transition-colors hover:bg-white/10 hover:text-white"
            >
              <CornerDownRight size={12} /> Responder
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-red-400 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 group-hover/comment:opacity-100"
              aria-label="Eliminar comentario"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
