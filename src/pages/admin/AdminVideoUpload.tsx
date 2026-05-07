import { useState, useRef, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileVideo,
  CheckCircle,
  Loader2,
  LogOut,
  LayoutDashboard,
  Video,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type UploadStatus = "idle" | "uploading" | "success";

interface FormState {
  title: string;
  description: string;
  module: string;
}

const INITIAL_FORM: FormState = { title: "", description: "", module: "" };

const AdminVideoUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [isDragging, setIsDragging] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

  const handleLogout = () => {
    navigate("/login");
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!videoFile || !formData.title || !formData.module) return;

    setStatus("uploading");

    // Mock — se reemplaza por upload directo a Cloudflare Stream cuando el back esté listo.
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
    <div className="min-h-screen bg-darker flex flex-col md:flex-row text-textMain font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-black/50 border-r border-white/5 flex-col pt-6 md:min-h-screen shrink-0 relative z-10 hidden md:flex">
        <div className="px-6 mb-10 flex items-center justify-center">
          <img src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public" alt="Logo Admin" className="h-12 object-contain" />
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <button
            type="button"
            className="flex items-center gap-3 w-full px-4 py-3 bg-gold text-darker font-bold rounded-xl shadow-[0_0_10px_rgba(204,164,59,0.3)]"
          >
            <UploadCloud size={20} /> Cargar Lección
          </button>
          <button
            type="button"
            className="flex items-center gap-3 w-full px-4 py-3 text-textMuted hover:text-white hover:bg-white/5 font-medium rounded-xl transition-all"
          >
            <LayoutDashboard size={20} /> Métricas
          </button>
          <button
            type="button"
            className="flex items-center gap-3 w-full px-4 py-3 text-textMuted hover:text-white hover:bg-white/5 font-medium rounded-xl transition-all"
          >
            <Video size={20} /> Gestor de Contenido
          </button>
          <button
            type="button"
            className="flex items-center gap-3 w-full px-4 py-3 text-textMuted hover:text-white hover:bg-white/5 font-medium rounded-xl transition-all"
          >
            <Users size={20} /> Usuarios
          </button>
          <button
            type="button"
            className="flex items-center gap-3 w-full px-4 py-3 text-textMuted hover:text-white hover:bg-white/5 font-medium rounded-xl transition-all"
          >
            <Settings size={20} /> Ajustes
          </button>
        </nav>

        <div className="p-4 mt-auto border-t border-white/5">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 font-medium rounded-xl transition-all"
          >
            <LogOut size={20} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 md:p-10 lg:p-16 relative overflow-y-auto">
        <div className="absolute top-0 right-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-gold opacity-[0.03] blur-[100px]"></div>

        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Cargar Contenido</h1>
            <p className="text-textMuted">Rellena los detalles y sube el archivo .mp4 de la nueva masterclass.</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/10 shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gold to-yellow-600 border border-gold flex items-center justify-center text-xs font-bold text-darker">
              AD
            </div>
            <div className="text-sm">
              <p className="font-bold text-white leading-none">Administrador VIP</p>
              <p className="text-xs text-gold">admin@escuela.com</p>
            </div>
          </div>
        </header>

        <div className="bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl rounded-3xl p-6 lg:p-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-10">
            {/* Datos del Video */}
            <div className="flex-1 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-textMuted uppercase tracking-wider">
                  Título de la Lección
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Ej: Estrategias de Retención Exponencial"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-textMuted uppercase tracking-wider">
                  Módulo Perteneciente
                </label>
                <div className="relative">
                  <select
                    name="module"
                    value={formData.module}
                    onChange={handleInputChange}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white appearance-none focus:outline-none focus:border-gold transition-all"
                    required
                  >
                    <option value="" disabled className="bg-darker">
                      Selecciona un Módulo Oficial
                    </option>
                    <option value="aprendizaje" className="bg-darker">
                      Inteligencia del aprendizaje
                    </option>
                    <option value="riqueza" className="bg-darker">
                      Inteligencia de la riqueza
                    </option>
                    <option value="emocional" className="bg-darker">
                      Inteligencia emocional
                    </option>
                    <option value="comercial" className="bg-darker">
                      Inteligencia Comercial y Negociadora
                    </option>
                    <option value="estrategica" className="bg-darker">
                      Inteligencia Estratégica
                    </option>
                    <option value="espiritual" className="bg-darker">
                      Inteligencia Espiritual
                    </option>
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/30"></div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-textMuted uppercase tracking-wider">
                  Descripción y Notas Resumen
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Se mostrará debajo del reproductor de video..."
                  rows={5}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all resize-none"
                ></textarea>
              </div>
            </div>

            {/* Subida del Archivo */}
            <div className="w-full lg:w-[400px] shrink-0">
              <label className="text-sm font-semibold text-textMuted uppercase tracking-wider block mb-2">
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
                  "relative w-full h-[300px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all",
                  isDragging ? "border-gold bg-gold/10" : "border-white/10 bg-black/30 hover:bg-black/50",
                  !videoFile && "cursor-pointer"
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
                  <div className="flex flex-col items-center justify-center text-center p-6">
                    <div className="w-16 h-16 bg-gold/20 text-gold rounded-full flex items-center justify-center mb-4 relative">
                      <FileVideo size={30} />
                      {status === "success" && (
                        <CheckCircle
                          className="absolute -bottom-1 -right-1 text-green-500 bg-darker rounded-full"
                          size={20}
                        />
                      )}
                    </div>
                    <p className="font-bold text-white text-lg line-clamp-1 w-full max-w-[200px]">{videoFile.name}</p>
                    <p className="text-sm text-textMuted mt-1">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>

                    {status === "idle" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVideoFile(null);
                        }}
                        className="mt-4 text-xs font-semibold px-4 py-2 bg-white/10 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
                      >
                        Reemplazar Archivo
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-6">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 text-white/50 group-hover:text-gold transition-colors">
                      <UploadCloud size={40} />
                    </div>
                    <p className="text-white font-bold text-lg">Arrastra tu video MP4 aquí</p>
                    <p className="text-sm text-textMuted mt-2 px-4">
                      El tamaño máximo recomendado por Cloudflare Stream es de 5GB por archivo.
                    </p>
                  </div>
                )}

                {status === "uploading" && (
                  <div className="absolute inset-0 z-10 bg-darker/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center">
                    <Loader2 size={40} className="text-gold animate-spin mb-4" />
                    <p className="font-bold text-white animate-pulse">Subiendo y Procesando...</p>
                    <p className="text-xs text-textMuted mt-2">No cierres esta pestaña</p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!videoFile || !formData.title || !formData.module || status === "uploading"}
                className="w-full mt-6 py-4 bg-gold hover:bg-goldHover disabled:opacity-50 disabled:hover:bg-gold disabled:cursor-not-allowed text-darker font-extrabold text-lg rounded-xl transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(204,164,59,0.3)] disabled:shadow-none"
              >
                {status === "idle" && "Publicar Masterclass"}
                {status === "uploading" && "Codificando..."}
                {status === "success" && (
                  <>
                    <CheckCircle size={20} /> ¡Publicado con éxito!
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default AdminVideoUpload;
