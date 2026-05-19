import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Plus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import {
  deletePost,
  fetchPosts,
  type CommunityCategory,
  type CommunityPost,
  type CommunitySort,
} from "@/lib/api/community";
import { CATEGORIES } from "./community-utils";
import { PostCard } from "./PostCard";
import { NewPostDialog } from "./NewPostDialog";
import { PostDetail } from "./PostDetail";

interface CommunityFeedProps {
  currentUserId: string;
  isAdmin: boolean;
}

export function CommunityFeed({ currentUserId, isAdmin }: CommunityFeedProps) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<CommunitySort>("recent");
  const [category, setCategory] = useState<CommunityCategory | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const list = await fetchPosts(sort, category ?? undefined);
    setPosts(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, category]);

  // Realtime: nuevos posts
  useEffect(() => {
    const channel = supabase
      .channel("community_posts_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_posts" },
        () => {
          load();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "community_posts" },
        (payload) => {
          const oldId = (payload.old as { id?: string }).id;
          if (oldId) setPosts((prev) => prev.filter((p) => p.id !== oldId));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, category]);

  const handleDeleteFromCard = async (post: CommunityPost) => {
    if (!confirm("¿Eliminar esta publicación?")) return;
    try {
      await deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast.success("Publicación eliminada");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar");
    }
  };

  if (selectedPostId) {
    return (
      <PostDetail
        postId={selectedPostId}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onBack={() => {
          setSelectedPostId(null);
          load();
        }}
        onDeleted={() => {
          setSelectedPostId(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <Users className="text-gold" /> Comunidad VIP
          </h2>
          <p className="text-textMuted text-sm mt-1">
            Conecta con miembros, comparte preguntas e ideas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-darker font-bold hover:bg-goldHover transition-colors shadow-[0_0_20px_rgba(204,164,59,0.2)]"
        >
          <Plus size={18} /> Nueva publicación
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-textMuted uppercase tracking-wide">Ordenar:</span>
          <div className="flex gap-1.5">
            {([
              { id: "recent", label: "Recientes" },
              { id: "popular", label: "Más populares" },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSort(opt.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  sort === opt.id
                    ? "bg-gold text-darker"
                    : "bg-white/5 text-textMuted hover:bg-white/10 hover:text-white"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-textMuted uppercase tracking-wide">Categoría:</span>
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
              category === null
                ? "bg-gold text-darker border-gold"
                : "bg-white/5 text-textMuted border-white/10 hover:border-white/20"
            )}
          >
            Todas
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                category === c.id
                  ? "bg-gold text-darker border-gold"
                  : "bg-white/5 text-textMuted border-white/10 hover:border-white/20"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-gold" size={32} />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
          <MessageSquare className="mx-auto text-gold/60 mb-4" size={40} />
          <h3 className="text-lg font-bold text-white mb-2">Aún no hay publicaciones</h3>
          <p className="text-textMuted text-sm mb-5">Sé el primero en iniciar una conversación.</p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-darker font-bold hover:bg-goldHover transition-colors"
          >
            <Plus size={16} /> Crear publicación
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              canDelete={isAdmin || post.author_id === currentUserId}
              onOpen={() => setSelectedPostId(post.id)}
              onDelete={() => handleDeleteFromCard(post)}
            />
          ))}
        </div>
      )}

      <NewPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(post) => {
          setPosts((prev) => [post, ...prev]);
          setSelectedPostId(post.id);
        }}
      />
    </div>
  );
}
