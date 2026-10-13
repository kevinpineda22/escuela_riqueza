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
  const [uploading, setUploading] = useState(false);
  // Errores en línea, junto al campo (antes eran toasts que se iban solos).
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setBody("");
    setImageUrl(null);
    setIsPinned(false);
    setCategory("pregunta");
    setErrors({});
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Con la imagen subiendo no se publica: el post saldría sin adjunto.
    if (submitting || uploading) return;
    const t = title.trim();
    const b = body.trim();
    const nextErrors: typeof errors = {};
    if (t.length < 3 || t.length > 200) nextErrors.title = "El título debe tener entre 3 y 200 caracteres.";
    if (b.length < 1 || b.length > 10000) nextErrors.body = "Escribe el contenido (máximo 10.000 caracteres).";
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.body) {
      document.getElementById(nextErrors.title ? "new-post-title" : "new-post-body")?.focus();
      return;
    }
    setSubmitError(null);
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
      // El texto y la imagen se conservan para reintentar.
      setSubmitError("No se pudo publicar. Tu texto sigue aquí: inténtalo de nuevo.");
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
      <DialogContent className="max-w-2xl flex-col overflow-hidden gap-0 border-line-subtle bg-gradient-to-br from-surface-page via-surface-page to-surface-panel p-0">
        {/* gold glow */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />

        <DialogHeader className="relative shrink-0 border-b border-line-subtle bg-surface-page/95 light:bg-surface-panel px-6 pb-5 pt-6 sm:px-8">
          <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
            <Sparkles size={10} aria-hidden /> Comunidad
          </div>
          <DialogTitle className="text-2xl font-extrabold tracking-tight text-foreground-strong sm:text-3xl">
            Crear publicación
          </DialogTitle>
          <DialogDescription className="text-foreground-muted">
            Comparte una pregunta, idea o recurso con la comunidad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6 pt-5 sm:px-8">
          {/* Categoría — cards */}
          <div>
            <p id="new-post-category" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              Categoría
            </p>
            <div role="radiogroup" aria-labelledby="new-post-category" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.id;
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "group/cat relative flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border bg-gradient-to-br p-3 text-xs font-semibold transition-all",
                      active
                        ? cn("border-accent text-foreground-strong", c.chip, c.accent)
                        : "border-line-subtle from-white/[0.03] to-transparent light:from-surface-panel light:to-surface-panel text-foreground-muted hover:border-ink/20 hover:text-foreground-strong"
                    )}
                  >
                    <Icon size={18} className={active ? "text-accent" : ""} />
                    <span>{c.label}</span>
                    {active && (
                      <motion.span
                        layoutId="catActive"
                        className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-focus/50"
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
              <label htmlFor="new-post-title" className="block text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                Título
              </label>
              <span className="text-[10px] tabular-nums text-foreground-muted/70">{title.length} / 200</span>
            </div>
            <input
              id="new-post-title"
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors((p) => ({ ...p, title: undefined })); }}
              aria-invalid={Boolean(errors.title) || undefined}
              aria-describedby={errors.title ? "new-post-title-error" : undefined}
              maxLength={200}
              placeholder="¿De qué quieres hablar?"
              className="w-full rounded-xl border border-line-subtle bg-black/40 light:bg-surface-input light:border-line-control/50 light:placeholder:text-foreground-placeholder px-4 py-3 text-foreground-strong transition-colors placeholder:text-foreground-muted focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-focus/20 aria-[invalid=true]:border-red-500/60"
            />
            {errors.title && (
              <p id="new-post-title-error" className="mt-1.5 text-xs text-red-300 light:text-danger">{errors.title}</p>
            )}
          </div>

          {/* Contenido */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="new-post-body" className="block text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                Contenido
              </label>
              <span className="text-[10px] tabular-nums text-foreground-muted/70">{body.length} / 10.000</span>
            </div>
            <textarea
              id="new-post-body"
              value={body}
              onChange={(e) => { setBody(e.target.value); if (errors.body) setErrors((p) => ({ ...p, body: undefined })); }}
              aria-invalid={Boolean(errors.body) || undefined}
              aria-describedby={errors.body ? "new-post-body-error" : undefined}
              maxLength={10000}
              rows={8}
              placeholder="Desarrolla tu idea aquí…"
              className="w-full resize-y rounded-xl border border-line-subtle bg-black/40 light:bg-surface-input light:border-line-control/50 light:placeholder:text-foreground-placeholder px-4 py-3 text-foreground-strong transition-colors placeholder:text-foreground-muted focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-focus/20 aria-[invalid=true]:border-red-500/60"
            />
            {errors.body && (
              <p id="new-post-body-error" className="mt-1.5 text-xs text-red-300 light:text-danger">{errors.body}</p>
            )}
          </div>

          {/* Image Upload */}
          <div>
            <p className="block text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-2">
              Imagen adjunta (Opcional)
            </p>
            <PostImageUploader value={imageUrl} onChange={setImageUrl} disabled={submitting} onUploadingChange={setUploading} />
          </div>

          {/* Admin: Pin Post */}
          {isAdmin && (
            <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
              <input
                type="checkbox"
                id="pin-post"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="h-4 w-4 rounded border-ink/20 bg-black/40 light:bg-surface-input text-accent focus:ring-focus/50 focus:ring-offset-0"
              />
              <label htmlFor="pin-post" className="text-sm font-medium text-foreground-strong cursor-pointer select-none">
                Fijar publicación
                <p className="text-xs text-foreground-muted font-normal">Aparecerá siempre arriba en el foro.</p>
              </label>
            </div>
          )}
          </div>

          {submitError && (
            <p role="alert" className="shrink-0 border-t border-red-500/20 bg-red-500/10 px-6 py-2.5 text-sm text-red-300 light:text-danger sm:px-8">
              {submitError}
            </p>
          )}
          <div className="shrink-0 flex items-center justify-end gap-2 border-t border-line-subtle bg-surface-page/95 light:bg-surface-panel px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="rounded-xl px-5 py-2.5 text-foreground-muted transition-colors hover:bg-ink/5 hover:text-foreground-strong disabled:opacity-50"
            >
              Cancelar
            </button>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.97 }}
              disabled={submitting || uploading}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-bold text-on-brand shadow-[0_6px_24px_-8px_rgba(204,164,59,0.6)] transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {submitting || uploading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
              {submitting ? "Publicando…" : uploading ? "Subiendo imagen…" : "Publicar"}
            </motion.button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
