import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { createPost, type CommunityCategory, type CommunityPost } from "@/lib/api/community";
import { CATEGORIES } from "./community-utils";
import { cn } from "@/lib/utils";
import { PostImageUploader } from "./PostImageUploader";

interface NewPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (post: CommunityPost) => void;
  isAdmin?: boolean;
}

export function NewPostDialog({ open, onOpenChange, onCreated, isAdmin }: NewPostDialogProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [category, setCategory] = useState<CommunityCategory>("pregunta");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    setBody("");
    setImageUrl(null);
    setIsPinned(false);
    setCategory("pregunta");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const t = title.trim();
    const b = body.trim();
    if (t.length < 3 || t.length > 200) {
      toast.error("El título debe tener entre 3 y 200 caracteres");
      return;
    }
    if (b.length < 1 || b.length > 10000) {
      toast.error("El contenido es obligatorio (máx 10.000 caracteres)");
      return;
    }
    setSubmitting(true);
    try {
      const post = await createPost({ 
        title: t, 
        body: b, 
        category, 
        image_url: imageUrl || undefined,
        is_pinned: isPinned
      });
      toast.success("¡Publicación creada!");
      onCreated(post);
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo crear la publicación");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl flex-col overflow-hidden gap-0 border-white/10 bg-gradient-to-br from-darker via-darker to-dark p-0">
        {/* gold glow */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gold/15 blur-3xl" />

        <DialogHeader className="relative shrink-0 border-b border-white/10 bg-darker/95 px-6 pb-5 pt-6 sm:px-8">
          <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
            <Sparkles size={10} /> Comunidad VIP
          </div>
          <DialogTitle className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Crear publicación
          </DialogTitle>
          <DialogDescription className="text-textMuted">
            Comparte una pregunta, idea o recurso con la comunidad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6 pt-5 sm:px-8">
          {/* Categoría — cards */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-textMuted">
              Categoría
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.id;
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "group/cat relative flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border bg-gradient-to-br p-3 text-xs font-semibold transition-all",
                      active
                        ? cn("border-gold text-white", c.chip, c.accent)
                        : "border-white/10 from-white/[0.03] to-transparent text-textMuted hover:border-white/20 hover:text-white"
                    )}
                  >
                    <Icon size={18} className={active ? "text-gold" : ""} />
                    <span>{c.label}</span>
                    {active && (
                      <motion.span
                        layoutId="catActive"
                        className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-gold/50"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wide text-textMuted">
                Título
              </label>
              <span className="text-[10px] tabular-nums text-textMuted/70">{title.length} / 200</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="¿De qué quieres hablar?"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white transition-colors placeholder:text-textMuted focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20"
            />
          </div>

          {/* Contenido */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wide text-textMuted">
                Contenido
              </label>
              <span className="text-[10px] tabular-nums text-textMuted/70">{body.length} / 10.000</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={10000}
              rows={8}
              placeholder="Desarrolla tu idea aquí…"
              className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white transition-colors placeholder:text-textMuted focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-textMuted mb-2">
              Imagen adjunta (Opcional)
            </label>
            <PostImageUploader value={imageUrl} onChange={setImageUrl} disabled={submitting} />
          </div>

          {/* Admin: Pin Post */}
          {isAdmin && (
            <div className="flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4">
              <input
                type="checkbox"
                id="pin-post"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black/40 text-gold focus:ring-gold/50 focus:ring-offset-0"
              />
              <label htmlFor="pin-post" className="text-sm font-medium text-white cursor-pointer select-none">
                Fijar publicación
                <p className="text-xs text-textMuted font-normal">Aparecerá siempre arriba en el foro.</p>
              </label>
            </div>
          )}
          </div>

          <div className="shrink-0 flex items-center justify-end gap-2 border-t border-white/10 bg-darker/95 px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="rounded-xl px-5 py-2.5 text-textMuted transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              Cancelar
            </button>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.97 }}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 font-bold text-darker shadow-[0_6px_24px_-8px_rgba(204,164,59,0.6)] transition-colors hover:bg-goldHover disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {submitting ? "Publicando…" : "Publicar"}
            </motion.button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
