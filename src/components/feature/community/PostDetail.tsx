import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageSquare, Pin, Send, Trash2 } from "lucide-react";
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

  // Realtime de comentarios
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
        // ↑ si replyTo es ya hijo (tiene parent_id), aplanamos al mismo padre raíz
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-20">
        <p className="text-textMuted">No se encontró la publicación.</p>
        <button onClick={onBack} className="mt-4 text-gold hover:underline">
          Volver al foro
        </button>
      </div>
    );
  }

  const cat = categoryMeta(post.category);
  const canDeletePost = isAdmin || post.author_id === currentUserId;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-textMuted hover:text-gold transition-colors text-sm"
      >
        <ArrowLeft size={16} /> Volver al foro
      </button>

      {/* Post */}
      <article className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8">
        <header className="flex items-start gap-4 mb-5">
          <div className="shrink-0 w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold font-bold overflow-hidden">
            {post.author?.avatar_url ? (
              <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              authorInitials(post.author)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-textMuted">
              <span className="text-white/90 font-semibold">{authorName(post.author)}</span>
              {post.author?.role === "admin" && (
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
          </div>
          {canDeletePost && (
            <button
              type="button"
              onClick={handleDeletePost}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          )}
        </header>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4 leading-tight">{post.title}</h2>
        <div className="prose prose-invert max-w-none whitespace-pre-wrap text-textMain leading-relaxed">
          {post.body}
        </div>

        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-white/10">
          <LikeButton
            targetType="post"
            targetId={post.id}
            liked={post.liked_by_me ?? false}
            count={post.like_count}
          />
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 text-textMuted text-sm">
            <MessageSquare size={16} />
            <span className="font-semibold tabular-nums">{comments.length}</span>
          </div>
        </div>
      </article>

      {/* Comments */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <MessageSquare size={18} className="text-gold" /> Comentarios ({comments.length})
        </h3>

        {/* New comment form */}
        <form onSubmit={handleSubmit} className="mb-6 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          {replyTo && (
            <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg bg-gold/10 border border-gold/20 text-xs">
              <span className="text-textMuted">
                Respondiendo a <strong className="text-gold">{authorName(replyTo.author)}</strong>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-textMuted hover:text-white"
              >
                Cancelar
              </button>
            </div>
          )}
          <textarea
            ref={replyInputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={3}
            placeholder={replyTo ? "Escribe tu respuesta…" : "Escribe un comentario…"}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-textMuted focus:outline-none focus:border-gold/50 transition-colors resize-y"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-textMuted/70">{body.length}/5.000</span>
            <button
              type="submit"
              disabled={submitting || body.trim().length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-darker font-bold text-sm hover:bg-goldHover transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {replyTo ? "Responder" : "Comentar"}
            </button>
          </div>
        </form>

        {/* Threaded list */}
        {tree.roots.length === 0 ? (
          <div className="text-center py-10 text-textMuted text-sm">
            Sé el primero en comentar.
          </div>
        ) : (
          <div className="space-y-4">
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
          </div>
        )}
      </section>
    </div>
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
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
      <CommentBody
        comment={comment}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onReply={onReply}
        onDelete={onDelete}
      />
      {replies.length > 0 && (
        <div className="mt-4 pl-4 sm:pl-6 border-l-2 border-white/10 space-y-3">
          {replies.map((r) => (
            <CommentBody
              key={r.id}
              comment={r}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onReply={onReply}
              onDelete={onDelete}
              isReply
            />
          ))}
        </div>
      )}
    </div>
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
    <div className={cn("flex items-start gap-3", isReply && "pt-1")}>
      <div className="shrink-0 w-9 h-9 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold text-xs font-bold overflow-hidden">
        {comment.author?.avatar_url ? (
          <img src={comment.author.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          authorInitials(comment.author)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-textMuted mb-1">
          <span className="text-white/90 font-semibold">{authorName(comment.author)}</span>
          {authorIsAdmin && (
            <span className="px-1.5 py-0.5 rounded bg-gold/15 text-gold text-[10px] font-bold uppercase tracking-wide">
              Admin
            </span>
          )}
          <span>·</span>
          <span>{formatRelative(comment.created_at)}</span>
        </div>
        <p className="text-sm text-textMain whitespace-pre-wrap leading-relaxed">{comment.body}</p>
        <div className="flex items-center gap-2 mt-2">
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
              className="px-2 py-1 rounded-lg text-xs text-textMuted hover:text-white hover:bg-white/10 transition-colors"
            >
              Responder
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
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
