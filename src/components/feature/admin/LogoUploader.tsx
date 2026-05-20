import { useRef, useState } from "react";
import { Upload, Loader2, ImageIcon, AlertCircle, RefreshCw } from "lucide-react";
import { authedFetch, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

interface LogoUploaderProps {
  /** URL actual del logo (puede ser null si nunca se subió uno) */
  value: string | null;
  /** Callback cuando se sube uno nuevo. Pasa la URL pública final. */
  onChange: (url: string) => void;
  /** Logo de fallback a mostrar si `value` está vacío */
  fallback?: string;
}

const ACCEPTED_TYPES = ["image/png", "image/svg+xml", "image/webp", "image/jpeg"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const LogoUploader = ({ value, onChange, fallback }: LogoUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const displayUrl = preview || value || fallback || null;

  const handlePick = () => {
    setError(null);
    inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input para poder re-seleccionar el mismo archivo
    e.target.value = "";

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato no soportado. Usá PNG, SVG, WebP o JPG.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. Máximo 2 MB.`);
      return;
    }

    // Preview local mientras sube
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);
    setError(null);

    try {
      // 1) Pedir direct upload URL a nuestro endpoint
      const tokenRes = await authedFetch("/api/images/upload-url", {
        method: "POST",
        body: JSON.stringify({ purpose: "logo" }),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Fallo al pedir URL de subida (${tokenRes.status})`);
      }

      const { uploadURL, deliveryUrl } = (await tokenRes.json()) as {
        uploadURL: string;
        imageId: string;
        deliveryUrl: string;
      };

      // 2) Subir el archivo directo a Cloudflare (multipart/form-data)
      const form = new FormData();
      form.append("file", file);

      const uploadRes = await fetch(uploadURL, {
        method: "POST",
        body: form,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error("Cloudflare upload failed:", uploadRes.status, errText);
        throw new Error("Cloudflare rechazó el archivo. Revisá el formato o probá de nuevo.");
      }

      // 3) Confirmamos URL final
      onChange(deliveryUrl);
      toast.success("Logo actualizado. Guardá los cambios para aplicarlo en toda la plataforma.");
      // El preview local lo dejamos limpio (la URL real ya está en value via onChange)
      setPreview(null);
      URL.revokeObjectURL(localPreview);
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error inesperado al subir el logo";
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
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "relative w-20 h-20 rounded-2xl border border-white/10 bg-darker flex items-center justify-center overflow-hidden shrink-0",
            uploading && "opacity-60",
          )}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Logo actual"
              className="w-full h-full object-contain p-2"
            />
          ) : (
            <ImageIcon className="text-white/30" size={28} />
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="text-gold animate-spin" size={22} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePick}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold hover:bg-goldHover text-darker text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {value ? <RefreshCw size={14} /> : <Upload size={14} />}
              {uploading ? "Subiendo..." : value ? "Cambiar logo" : "Subir logo"}
            </button>
            {value && !uploading && (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-white/40 hover:text-gold underline truncate max-w-[200px]"
              >
                Ver original
              </a>
            )}
          </div>
          <p className="mt-2 text-[11px] text-textMuted leading-relaxed">
            PNG, SVG, WebP o JPG. Máx 2 MB. Recomendado: fondo transparente, alto ≥ 80px.
          </p>
        </div>
      </div>

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
      />
    </div>
  );
};

export default LogoUploader;
