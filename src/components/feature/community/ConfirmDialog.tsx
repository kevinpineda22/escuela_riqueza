import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  /** La acción destructiva. Si falla, el diálogo queda abierto para reintentar. */
  onConfirm: () => Promise<void>;
}

/**
 * Confirmación destructiva con el tema de la app. Reemplaza `confirm()` del
 * navegador, que no respeta claro/oscuro, no muestra progreso y en celular
 * se veía como un error del sistema.
 * Se abre controlado, sin `DialogTrigger`: Radix devuelve el foco al trigger y,
 * sin uno, lo dejaba en el body. Aquí se recuerda quién tenía el foco al abrir.
 */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }: ConfirmDialogProps) {
  const [working, setWorking] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const handleConfirm = async () => {
    if (working) return;
    setWorking(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // El llamador ya avisó del error: el diálogo queda abierto.
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!working) onOpenChange(v); }}>
      <DialogContent
        className="max-w-md gap-5 p-6 sm:p-7"
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(e) => {
          const target = returnFocusRef.current;
          returnFocusRef.current = null;
          // Si el disparador ya no existe (se eliminó lo que se confirmaba), Radix decide.
          if (target?.isConnected) {
            e.preventDefault();
            target.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground-strong">{title}</DialogTitle>
          {description && <DialogDescription className="text-foreground-muted">{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={working}
            className="min-h-11 rounded-xl px-5 text-foreground-muted transition-colors hover:bg-ink/5 hover:text-foreground-strong disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={working}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {working && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {working ? "Eliminando…" : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
