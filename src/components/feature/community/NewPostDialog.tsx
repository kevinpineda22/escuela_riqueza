import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { createPost, type CommunityCategory, type CommunityPost } from "@/lib/api/community";
import { CATEGORIES } from "./community-utils";
import { cn } from "@/lib/utils";

interface NewPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (post: CommunityPost) => void;
}

export function NewPostDialog({ open, onOpenChange, onCreated }: NewPostDialogProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<CommunityCategory>("pregunta");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    setBody("");
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
      const post = await createPost({ title: t, body: b, category });
      toast.success("Publicación creada");
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
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Nueva publicación</DialogTitle>
          <DialogDescription>
            Comparte una pregunta, idea o recurso con la comunidad VIP.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-textMuted uppercase tracking-wide mb-2">
              Categoría
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-xs font-semibold transition-all",
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

          <div>
            <label className="block text-xs font-semibold text-textMuted uppercase tracking-wide mb-2">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="¿De qué quieres hablar?"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-textMuted focus:outline-none focus:border-gold/50 transition-colors"
            />
            <div className="text-[10px] text-textMuted/70 mt-1 text-right">{title.length}/200</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-textMuted uppercase tracking-wide mb-2">
              Contenido
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={10000}
              rows={8}
              placeholder="Escribe aquí…"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-textMuted focus:outline-none focus:border-gold/50 transition-colors resize-y"
            />
            <div className="text-[10px] text-textMuted/70 mt-1 text-right">{body.length}/10.000</div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-textMuted hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-darker font-bold hover:bg-goldHover transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Publicar
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
