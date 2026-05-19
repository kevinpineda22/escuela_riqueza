import { useEffect, useState } from "react";
import { Loader2, UploadCloud, Film, CheckCircle2, X } from "lucide-react";
import { motion } from "motion/react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter
} from "@/components/ui/sheet";
import { PlansSelector, type Plan } from "./PlansSelector";
import { toast } from "@/components/ui/toaster";
import {
  getDirectUploadUrl, uploadFileWithProgress, type Lesson
} from "@/lib/api/stream/content";

export interface LessonSubmitValues {
  title: string;
  description: string;
  allowed_plans: Plan[];
  stream_uid: string | null;
}

interface LessonFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Lesson | null;
  onSubmit: (values: LessonSubmitValues) => Promise<void>;
}

const DEFAULT_PLANS: Plan[] = ["free", "individual", "vip"];

export const LessonFormSheet = ({
  open, onOpenChange, mode, initial, onSubmit,
}: LessonFormSheetProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [file, setFile] = useState<File | null>(null);
  const [existingStreamUid, setExistingStreamUid] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? "");
      setPlans((initial.allowed_plans as Plan[]) ?? DEFAULT_PLANS);
      setExistingStreamUid(initial.stream_uid);
    } else {
      setTitle("");
      setDescription("");
      setPlans(DEFAULT_PLANS);
      setExistingStreamUid(null);
    }
    setFile(null);
    setUploadProgress(null);
  }, [open, mode, initial]);

  const pickFile = (selected: File | null | undefined) => {
    if (!selected) return;
    if (!selected.type.startsWith("video/")) {
      toast.error("Tipo no válido", { description: "El archivo debe ser un video (MP4, MOV, WebM)." });
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      let stream_uid: string | null = existingStreamUid;
      if (file) {
        setUploadProgress(0);
        try {
          const { uploadURL, uid } = await getDirectUploadUrl(file.size, file.name);
          await uploadFileWithProgress(uploadURL, file, (pct) => setUploadProgress(pct));
          stream_uid = uid;
        } finally {
          setUploadProgress(null);
        }
      }
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        allowed_plans: plans,
        stream_uid,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error("Error al guardar lección", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const isBusy = saving || uploadProgress !== null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!isBusy) onOpenChange(v); }}>
      <SheetContent
        side="right"
        className="sm:max-w-lg w-full flex flex-col p-0 gap-0"
        onInteractOutside={(e) => { if (isBusy) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isBusy) e.preventDefault(); }}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center text-gold">
              <Film size={18} />
            </span>
            <div>
              <SheetTitle className="text-lg">
                {mode === "create" ? "Nueva lección" : "Editar lección"}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {mode === "create"
                  ? "Subí el video y configurá el acceso."
                  : "Actualizá los datos. El video se reemplaza solo si subís uno nuevo."}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Episodio 1 — El Despertar"
              autoFocus
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles de la lección..."
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
                Video {mode === "edit" && existingStreamUid && "(reemplazo opcional)"}
              </label>
              {existingStreamUid && !file && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-green-300">
                  <CheckCircle2 size={11} /> Video actual cargado
                </span>
              )}
            </div>

            {file ? (
              <div className="flex items-center gap-3 bg-gold/5 border border-gold/30 rounded-lg p-3">
                <div className="w-10 h-10 rounded-md bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
                  <Film size={18} className="text-gold" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{file.name}</p>
                  <p className="text-xs text-textMuted font-mono">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                {!isBusy && (
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="shrink-0 p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                    aria-label="Quitar archivo"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div
                className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                  dragActive
                    ? "border-gold bg-gold/5"
                    : "border-white/10 hover:border-gold/30 bg-black/20 hover:bg-black/40"
                } ${isBusy ? "pointer-events-none opacity-50" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  pickFile(e.dataTransfer.files[0]);
                }}
                onClick={() => !isBusy && document.getElementById("lesson-video-file")?.click()}
              >
                <input
                  id="lesson-video-file"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  disabled={isBusy}
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
                <UploadCloud size={28} className="text-white/30 mb-2" />
                <p className="text-sm font-semibold text-white mb-0.5">
                  Arrastrá un video o hacé clic
                </p>
                <p className="text-xs text-textMuted">MP4, MOV, WebM — hasta 5GB</p>
              </div>
            )}

            {uploadProgress !== null && (
              <div className="bg-black/40 border border-white/10 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-1.5 text-white/70 font-semibold">
                    <Loader2 size={12} className="animate-spin text-gold" /> Subiendo a Cloudflare
                  </span>
                  <span className="text-gold font-bold tabular-nums">{uploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gold"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            )}
          </div>

          <PlansSelector value={plans} onChange={setPlans} />
        </div>

        <SheetFooter className="px-6 py-4 border-t border-white/5 bg-darker/60">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
            className="px-4 py-2 text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || isBusy}
            className="flex items-center justify-center gap-2 px-5 py-2 bg-gold hover:bg-goldHover text-black rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBusy && <Loader2 size={14} className="animate-spin" />}
            {uploadProgress !== null
              ? "Subiendo..."
              : mode === "create"
              ? "Crear lección"
              : "Guardar"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
