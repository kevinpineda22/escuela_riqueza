import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Flame, MessageSquare, Plus, Sparkles, Clock, Users } from "lucide-react";
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

  const stats = useMemo(() => {
    const totalLikes = posts.reduce((a, p) => a + (p.like_count ?? 0), 0);
    const totalComments = posts.reduce((a, p) => a + (p.comment_count ?? 0), 0);
    const uniqueAuthors = new Set(posts.map((p) => p.author_id)).size;
    return { totalPosts: posts.length, totalLikes, totalComments, uniqueAuthors };
  }, [posts]);

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
      {/* Hero header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-br from-gold/[0.08] via-white/[0.02] to-transparent p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold">
              <Sparkles size={12} /> Espacio exclusivo VIP
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Comunidad <span className="bg-gradient-to-r from-gold to-goldHover bg-clip-text text-transparent">VIP</span>
            </h2>
            <p className="mt-2 max-w-xl text-sm text-textMuted sm:text-base">
              Conecta con otros miembros, comparte preguntas, ideas y recursos.
            </p>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setDialogOpen(true)}
            className="group relative inline-flex items-center justify-center gap-2 self-start overflow-hidden rounded-2xl bg-gold px-6 py-3 font-bold text-darker shadow-[0_8px_32px_-8px_rgba(204,164,59,0.6)] transition-all hover:bg-goldHover sm:self-end"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <Plus size={18} /> Nueva publicación
          </motion.button>
        </div>

        {/* mini stats strip */}
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill icon={MessageSquare} label="Publicaciones" value={stats.totalPosts} />
          <StatPill icon={Flame} label="Me gusta" value={stats.totalLikes} />
          <StatPill icon={MessageSquare} label="Comentarios" value={stats.totalComments} />
          <StatPill icon={Users} label="Miembros activos" value={stats.uniqueAuthors} />
        </div>
      </motion.div>

      {/* Filters bar */}
      <div className="sticky top-2 z-10 flex flex-col gap-3 rounded-2xl border border-white/10 bg-darker/80 p-3 backdrop-blur-xl sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/5">
            {([
              { id: "recent", label: "Recientes", icon: Clock },
              { id: "popular", label: "Populares", icon: Flame },
            ] as const).map((opt) => {
              const Icon = opt.icon;
              const active = sort === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSort(opt.id)}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    active ? "text-darker" : "text-textMuted hover:text-white"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sortPill"
                      className="absolute inset-0 -z-10 rounded-lg bg-gold shadow-[0_0_16px_rgba(204,164,59,0.4)]"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <Icon size={13} /> {opt.label}
                </button>
              );
            })}
          </div>

          <div className="hidden text-xs text-textMuted sm:block">
            {posts.length} {posts.length === 1 ? "publicación" : "publicaciones"}
          </div>
        </div>

        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CategoryChip active={category === null} onClick={() => setCategory(null)} label="Todas" />
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <CategoryChip
                key={c.id}
                active={category === c.id}
                onClick={() => setCategory(c.id)}
                label={c.label}
                icon={<Icon size={12} />}
              />
            );
          })}
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} delay={i * 0.08} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-gradient-to-br from-white/[0.03] to-transparent py-16 text-center"
        >
          <div className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 ring-1 ring-gold/30"
          >
            <MessageSquare className="text-gold" size={28} />
          </motion.div>
          <h3 className="mb-2 text-xl font-bold text-white">Aún no hay publicaciones</h3>
          <p className="mx-auto mb-6 max-w-sm text-sm text-textMuted">
            Sé el primero en iniciar una conversación. Pregunta, comparte una idea o un recurso valioso.
          </p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 font-bold text-darker transition-colors hover:bg-goldHover"
          >
            <Plus size={16} /> Crear la primera
          </button>
        </motion.div>
      ) : (
        <motion.div layout className="space-y-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                canDelete={isAdmin || post.author_id === currentUserId}
                onOpen={() => setSelectedPostId(post.id)}
                onDelete={() => handleDeleteFromCard(post)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
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

function StatPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 backdrop-blur-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold ring-1 ring-gold/20">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <div className="text-base font-bold tabular-nums text-white leading-none">{value}</div>
        <div className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-textMuted">{label}</div>
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
        active
          ? "border-gold bg-gold text-darker shadow-[0_0_14px_rgba(204,164,59,0.35)]"
          : "border-white/10 bg-white/[0.03] text-textMuted hover:border-white/25 hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
    >
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-white/10" />
        <div className="flex-1 space-y-3">
          <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-white/15" />
          <div className="h-3 w-full animate-pulse rounded bg-white/10" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-white/10" />
        </div>
      </div>
    </motion.div>
  );
}
