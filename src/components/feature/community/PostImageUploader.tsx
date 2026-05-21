import { useRef, useState } from "react";
import { ImagePlus, Loader2, X, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

interface PostImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ["image/png", "image/webp", "image/jpeg", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function PostImageUploader({ value, onChange, disabled }: PostImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
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
        <div className="relative rounded-xl border border-white/10 bg-darker overflow-hidden group">
          <img src={displayUrl} alt="Adjunto" className={cn("w-full h-auto max-h-[300px] object-cover transition-opacity", uploading && "opacity-50")} />
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center">
               <Loader2 className="text-gold animate-spin" size={32} />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-red-500/80 hover:text-white transition-colors backdrop-blur-md opacity-0 group-hover:opacity-100"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          disabled={disabled || uploading}
          className="w-full py-4 border-2 border-dashed border-white/10 hover:border-gold/30 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] text-textMuted hover:text-gold flex flex-col items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ImagePlus size={24} />
          <span className="text-sm font-medium">Adjuntar imagen (Opcional)</span>
          <span className="text-xs opacity-60">PNG, JPG, WebP. Máx 5 MB.</span>
        </button>
      )}

      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
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
