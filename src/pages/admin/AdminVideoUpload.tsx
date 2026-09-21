import { useState, useRef, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import {
  UploadCloud,
  FileVideo,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { motion, type Variants } from "motion/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type UploadStatus = "idle" | "uploading" | "success";

interface FormState {
  title: string;
  description: string;
  module: string;
}

const INITIAL_FORM: FormState = { title: "", description: "", module: "" };

const contentVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const AdminVideoUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [isDragging, setIsDragging] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (value: string) => {
    setFormData({ ...formData, module: value });
  };

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    if (file.type === "video/mp4") {
      setVideoFile(file);
    } else {
      alert("Por favor, sube únicamente archivos de formato .mp4");
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!videoFile || !formData.title || !formData.module) return;

    setStatus("uploading");

    // Mock — se reemplaza por upload directo a Cloudflare Stream
    setTimeout(() => {
      setStatus("success");
      setTimeout(() => {
        setStatus("idle");
        setFormData(INITIAL_FORM);
        setVideoFile(null);
      }, 3000);
    }, 2500);
  };

  return (
    <motion.div variants={contentVariants} initial="hidden" animate="visible" className="max-w-6xl mx-auto -mt-2">
      <motion.header variants={itemVariants} className="mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground-strong mb-1 tracking-tight">Cargar Contenido</h1>
        <p className="text-foreground-muted text-base">Añade la próxima masterclass al ecosistema.</p>
      </motion.header>

      <motion.div variants={itemVariants} className="bg-surface-page/40 border border-ink/[0.08] backdrop-blur-2xl rounded-[2rem] p-5 sm:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.4)] relative">
        {/* Brillo superior */}
        <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />

        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8 xl:gap-12">
          {/* Form Fields */}
          <div className="flex-1 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-fg-70 uppercase tracking-widest ml-1">
                Título de la Lección
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Ej: Estrategias de Retención Exponencial"
                className="w-full bg-black/40 border border-line-subtle rounded-2xl px-4 py-3.5 text-foreground-strong placeholder:text-fg-20 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-focus/50 focus:bg-black/60 light:focus:bg-surface-input transition-all shadow-inner text-base light:bg-surface-input light:border-line-control/50 light:placeholder:text-foreground-placeholder"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-fg-70 uppercase tracking-widest ml-1">
                Módulo Perteneciente
              </label>
              <Select value={formData.module} onValueChange={handleSelectChange} required>
                <SelectTrigger className="w-full bg-black/40 border border-line-subtle rounded-2xl px-4 py-4 sm:py-6 text-foreground-strong focus:ring-1 focus:ring-focus/50 focus:bg-black/60 light:focus:bg-surface-input transition-all shadow-inner text-sm sm:text-base data-[state=open]:border-brand/50 light:bg-surface-input light:border-line-control/50 light:placeholder:text-foreground-placeholder">
                  <SelectValue placeholder="Selecciona el módulo oficial" />
                </SelectTrigger>
                <SelectContent className="bg-surface-page border border-line-subtle rounded-xl shadow-2xl">
                  <SelectItem value="aprendizaje" className="text-foreground-strong hover:bg-ink/5 focus:bg-ink/10 focus:text-accent cursor-pointer transition-colors py-2.5">Inteligencia del aprendizaje</SelectItem>
                  <SelectItem value="riqueza" className="text-foreground-strong hover:bg-ink/5 focus:bg-ink/10 focus:text-accent cursor-pointer transition-colors py-2.5">Inteligencia de la riqueza</SelectItem>
                  <SelectItem value="emocional" className="text-foreground-strong hover:bg-ink/5 focus:bg-ink/10 focus:text-accent cursor-pointer transition-colors py-2.5">Inteligencia emocional</SelectItem>
                  <SelectItem value="comercial" className="text-foreground-strong hover:bg-ink/5 focus:bg-ink/10 focus:text-accent cursor-pointer transition-colors py-2.5">Inteligencia Comercial y Negociadora</SelectItem>
                  <SelectItem value="estrategica" className="text-foreground-strong hover:bg-ink/5 focus:bg-ink/10 focus:text-accent cursor-pointer transition-colors py-2.5">Inteligencia Estratégica</SelectItem>
                  <SelectItem value="espiritual" className="text-foreground-strong hover:bg-ink/5 focus:bg-ink/10 focus:text-accent cursor-pointer transition-colors py-2.5">Inteligencia Espiritual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-fg-70 uppercase tracking-widest ml-1">
                Descripción y Notas Resumen
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Se mostrará debajo del reproductor de video..."
                rows={3}
                className="w-full bg-black/40 border border-line-subtle rounded-2xl px-4 py-3.5 text-foreground-strong placeholder:text-fg-20 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-focus/50 focus:bg-black/60 light:focus:bg-surface-input transition-all resize-none shadow-inner text-base light:bg-surface-input light:border-line-control/50 light:placeholder:text-foreground-placeholder"
              ></textarea>
            </div>
          </div>

          {/* Upload Zone */}
          <div className="w-full lg:w-[400px] shrink-0 flex flex-col">
            <label className="text-xs font-bold text-fg-70 uppercase tracking-widest mb-1.5 ml-1">
              Archivo Multimedia (.MP4)
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !videoFile && fileInputRef.current?.click()}
              className={cn(
                "relative w-full flex-1 min-h-[200px] sm:min-h-[260px] border-2 border-dashed rounded-[1.5rem] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden",
                isDragging ? "border-accent bg-brand/10 scale-[1.02]" : "border-ink/15 bg-black/30 hover:bg-black/50 light:hover:bg-surface-subtle hover:border-ink/30 light:bg-surface-panel",
                !videoFile && "cursor-pointer group"
              )}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFile(e.target.files?.[0])}
                accept="video/mp4"
                className="hidden"
              />

              {videoFile ? (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center text-center p-6 z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-brand/20 to-amber-600/20 border border-brand/30 text-accent rounded-full flex items-center justify-center mb-4 relative shadow-[0_0_30px_rgba(204,164,59,0.2)]">
                    <FileVideo size={30} />
                    {status === "success" && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -bottom-1 -right-1 text-green-400 light:text-success bg-surface-page rounded-full border-2 border-surface-page">
                        <CheckCircle size={20} />
                      </motion.div>
                    )}
                  </div>
                  <p className="font-bold text-foreground-strong text-lg line-clamp-1 w-full max-w-[200px]">{videoFile.name}</p>
                  <p className="text-sm font-mono text-accent/70 mt-1">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>

                  {status === "idle" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVideoFile(null);
                      }}
                      className="mt-5 text-sm font-bold px-4 py-2 bg-ink/5 hover:bg-red-500/20 text-fg-70 hover:text-danger rounded-xl transition-all"
                    >
                      Reemplazar Archivo
                    </button>
                  )}
                </motion.div>
              ) : (
                <div className="text-center p-6 z-10 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-ink/[0.03] border border-ink/5 flex items-center justify-center mb-4 text-fg-30 group-hover:text-accent group-hover:bg-brand/10 group-hover:scale-110 transition-all duration-500">
                    <UploadCloud size={40} />
                  </div>
                  <p className="text-foreground-strong font-extrabold text-xl tracking-tight mb-2">Arrastra tu video aquí</p>
                  <p className="text-sm text-foreground-muted max-w-[220px] leading-relaxed">
                    Formato MP4. Máximo 5GB soportado por Cloudflare Stream.
                  </p>
                </div>
              )}

              {/* Capa de Loading */}
              {status === "uploading" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 bg-surface-page/90 backdrop-blur-md flex flex-col items-center justify-center">
                  <Loader2 size={40} className="text-accent animate-spin mb-4 drop-shadow-[0_0_10px_rgba(204,164,59,0.5)]" />
                  <p className="font-extrabold text-foreground-strong text-lg animate-pulse">Codificando en la Nube...</p>
                  <p className="text-xs text-accent mt-2 font-medium">Por favor no cierres esta pestaña</p>
                </motion.div>
              )}
            </div>

            <button
              type="submit"
              disabled={!videoFile || !formData.title || !formData.module || status === "uploading"}
              className="w-full mt-5 py-3.5 bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:bg-ink/10 disabled:text-fg-40 text-on-brand font-extrabold text-base rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(204,164,59,0.3)] disabled:shadow-none overflow-hidden relative group"
            >
              {status === "idle" && !(!videoFile || !formData.title || !formData.module) && (
                 <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              )}
              {status === "idle" && <span className="relative z-10">Publicar Masterclass</span>}
              {status === "uploading" && <span className="relative z-10">Procesando...</span>}
              {status === "success" && (
                <span className="relative z-10 flex items-center gap-2">
                  <CheckCircle size={20} /> ¡Publicado!
                </span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default AdminVideoUpload;
