import { useRef, useState } from "react";
import { ImagePlus, Loader2, X, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

interface PostImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  /** Avisa mientras la imagen se sube: publicar antes dejaba el post sin adjunto. */
  onUploadingChange?: (uploading: boolean) => void;
}

const ACCEPTED_TYPES = ["image/png", "image/webp", "image/jpeg", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function PostImageUploader({ value, onChange, disabled, onUploadingChange }: PostImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploadingState] = useState(false);
  const setUploading = (next: boolean) => {
    setUploadingState(next);
    onUploadingChange?.(next);
  };
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const displayUrl = preview || value || null;

  const handlePick = () => {
    setError(null);
    inputRef.current?.click();
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    e.target.value = "";

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato no soportado. Usa PNG, JPG, WebP o GIF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. Máximo 5 MB.`);
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);
    setError(null);

    try {
      // Validar auth real
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No estás autenticado.");

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${user.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("community_images")
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        throw new Error("No se pudo subir la imagen a Supabase Storage.");
      }

      const { data: { publicUrl } } = supabase.storage
        .from("community_images")
        .getPublicUrl(filePath);

      onChange(publicUrl);
      setPreview(null);
      URL.revokeObjectURL(localPreview);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Error inesperado al subir la imagen";
      setError(msg);
      toast.error(msg);
      setPreview(null);
      URL.revokeObjectURL(localPreview);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {displayUrl ? (
        <div className="relative rounded-xl border border-line-subtle bg-surface-page overflow-hidden group">
          <img src={displayUrl} alt="Vista previa de la imagen adjunta" className={cn("w-full h-auto max-h-[300px] object-cover transition-opacity", uploading && "opacity-50")} />
          {uploading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" role="status">
               <Loader2 className="text-accent animate-spin" size={32} aria-hidden />
               <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-media-foreground">Subiendo imagen…</span>
            </div>
          ) : (
            // Siempre visible: antes aparecía solo con hover y en celular o
            // con teclado no había forma de quitar la imagen.
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              aria-label="Quitar imagen"
              className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-full bg-black/60 text-media-foreground hover:bg-red-500/80 hover:text-media-foreground transition-colors backdrop-blur-md"
            >
              <X size={18} aria-hidden />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          disabled={disabled || uploading}
          className="w-full py-4 border-2 border-dashed border-line-subtle hover:border-brand/30 rounded-xl bg-ink/[0.02] hover:bg-ink/[0.04] light:bg-surface-panel light:hover:bg-surface-subtle text-foreground-muted hover:text-accent flex flex-col items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ImagePlus size={24} />
          <span className="text-sm font-medium">Adjuntar imagen (Opcional)</span>
          <span className="text-xs opacity-60">PNG, JPG, WebP. Máx 5 MB.</span>
        </button>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 light:text-danger">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-tight">{error}</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={handleFile}
        disabled={disabled || uploading}
      />
    </div>
  );
}
