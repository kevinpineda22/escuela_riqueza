import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { requestRecordingDownloadUrl } from "@/lib/api/stream/lives";

interface DownloadRecordingButtonProps {
  liveId: string;
}

/**
 * Descarga la grabación completa (archivo en R2). Se dispara con un `<a>`
 * temporal apuntando a la URL firmada, que lleva `Content-Disposition:
 * attachment`: el navegador gestiona la descarga (los archivos pesan GB, no se
 * pasan por memoria con fetch/blob).
 */
const DownloadRecordingButton = ({ liveId }: DownloadRecordingButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const url = await requestRecordingDownloadUrl(liveId);
      if (!url) {
        toast.error("No se pudo preparar la descarga. Inténtalo de nuevo en unos minutos.");
        return;
      }
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2 text-sm font-bold text-accent transition-colors hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <Download size={16} aria-hidden="true" />
        )}
        Descargar clase
      </button>
      <p className="text-xs text-foreground-muted">Archivo grande: te recomendamos descargarlo con WiFi.</p>
    </div>
  );
};

export default DownloadRecordingButton;
