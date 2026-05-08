import { useState, useRef, useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BookOpen,
  Target,
  Heart,
  Briefcase,
  Map,
  Lightbulb,
  PlayCircle,
  Trophy,
  Users,
  Edit3,
  Award,
  Video,
  User as UserIcon,
  Camera,
  Loader2
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LessonPlayer from "@/components/feature/LessonPlayer";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { PLANS } from "@/types/user";
import { supabase } from "@/lib/supabase";

interface ModuloItem {
  id: number;
  titulo: string;
  icono: ReactNode;
}

interface Leccion {
  id: number;
  titulo: string;
  duracion: string;
  modId: number;
  video: string;
}

const modulosData: ModuloItem[] = [
  { id: 1, titulo: "Inteligencia del aprendizaje", icono: <BookOpen className="text-gold w-6 h-6" /> },
  { id: 2, titulo: "Inteligencia de la riqueza", icono: <Target className="text-gold w-6 h-6" /> },
  { id: 3, titulo: "Inteligencia emocional", icono: <Heart className="text-gold w-6 h-6" /> },
  { id: 4, titulo: "Inteligencia Comercial y Negociadora", icono: <Briefcase className="text-gold w-6 h-6" /> },
  { id: 5, titulo: "Inteligencia Estratégica", icono: <Map className="text-gold w-6 h-6" /> },
  { id: 6, titulo: "Inteligencia Espiritual", icono: <Lightbulb className="text-gold w-6 h-6" /> },
];

const lecciones: Leccion[] = [
  { id: 1, titulo: "El camino a la libertad financiera", duracion: "45 min", modId: 2, video: "/clase1.mp4" },
  { id: 2, titulo: "Estrategias de inversión acelerada", duracion: "1h 15 min", modId: 2, video: "/clase1.mp4" },
  { id: 3, titulo: "Gestión de caja y presupuestos", duracion: "50 min", modId: 2, video: "/clase1.mp4" },
];

type TabId = "modulos" | "notas" | "certificados" | "comunidad" | "live" | "perfil";

const getInitials = (name: string) => {
  if (!name) return "US";
  const words = name.trim().split(" ");
  if (words.length >= 2) {
    return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("modulos");

  // Efecto para leer el parámetro '?tab=perfil' de la URL (desde el Header)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("tab") === "perfil") {
      setActiveTab("perfil");
    } else if (searchParams.get("tab") === "modulos") {
      setActiveTab("modulos");
    }
  }, [location.search]);
  const [selectedModule, setSelectedModule] = useState<number>(2);
  const [activeLesson] = useState<Leccion>(lecciones[0]!);
  const [personalNote, setPersonalNote] = useState("");

  // Estado para el panel de perfil
  const [profileName, setProfileName] = useState(user?.fullName || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file)); // Muestra la vista previa instantáneamente
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdatingProfile(true);
    setProfileMessage(null);
    try {
      let finalAvatarUrl = user.avatarUrl;

      // Si hay un archivo seleccionado, lo subimos primero
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}-${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
          
        finalAvatarUrl = publicUrl;
      }

      // Actualizamos los datos en la base de datos
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: profileName, avatar_url: finalAvatarUrl })
        .eq("id", user.id);
        
      if (error) throw error;
      
      setUser({ ...user, fullName: profileName, avatarUrl: finalAvatarUrl });
      setAvatarFile(null); // Limpiamos el archivo temporal
      setProfileMessage({ type: "success", text: "Perfil actualizado correctamente." });
    } catch (err: any) {
      console.error(err);
      setProfileMessage({ type: "error", text: "Error al actualizar: " + err.message });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const filteredLessons = lecciones.filter((l) => l.modId === selectedModule);

  // Helper para saber si el usuario tiene beneficios premium
  const isPremium = user?.plan === PLANS.INDIVIDUAL || user?.plan === PLANS.VIP;

  return (
    <div className="min-h-screen bg-darker selection:bg-gold/30 font-sans text-textMain flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar / Profile */}
        <aside className="col-span-1 border-r border-white/10 pr-6 lg:block hidden">
          <div className="mb-10 text-center">
            <div className="w-24 h-24 rounded-full bg-gold/10 flex items-center justify-center border-2 border-gold/30 mb-4 mx-auto text-3xl font-bold text-gold shadow-[0_0_15px_rgba(204,164,59,0.3)] overflow-hidden relative group">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                getInitials(profileName || "Usuario")
              )}
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <Camera size={24} className="text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUpdatingProfile} />
              </label>
            </div>
            <h3 className="text-xl font-bold text-white capitalize">{user?.fullName || "Estudiante"}</h3>
            <p className="text-xs text-gold mt-1 font-medium tracking-widest uppercase">
              Plan {user?.plan || "Free"}
            </p>
          </div>

          <div className="mb-8">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-textMuted">Progreso General</span>
              <span className="text-white font-medium">0%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gold to-goldHover" style={{ width: "0%" }}></div>
            </div>
          </div>

          <nav className="space-y-2">
            <button
              type="button"
              onClick={() => { navigate("/dashboard?tab=modulos"); setActiveTab("modulos"); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                activeTab === "modulos" ? "bg-white/10 text-white" : "text-textMuted hover:text-white hover:bg-white/5"
              )}
            >
              <PlayCircle size={18} /> Módulos y Clases
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("notas")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                activeTab === "notas" ? "bg-white/10 text-white" : "text-textMuted hover:text-white hover:bg-white/5"
              )}
            >
              <Edit3 size={18} /> Notas Personales
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("certificados")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                activeTab === "certificados" ? "bg-white/10 text-white" : "text-textMuted hover:text-white hover:bg-white/5"
              )}
            >
              <Award size={18} /> Certificados
            </button>

            {isPremium && (
              <button
                type="button"
                onClick={() => setActiveTab("comunidad")}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                  activeTab === "comunidad" ? "bg-white/10 text-white" : "text-textMuted hover:text-white hover:bg-white/5"
                )}
              >
                <Users size={18} /> Comunidad VIP
              </button>
            )}

            {user?.plan === PLANS.VIP && (
              <div className="pt-4 mt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => navigate("/vip-live")}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Video size={18} />
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    </div>
                    Eventos en Vivo
                  </div>
                </button>
              </div>
            )}
          </nav>
        </aside>

        {/* Contenido Principal */}
        <div className="col-span-1 lg:col-span-3">
          {activeTab === "modulos" && (
            <>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide mb-8">
                {modulosData.map((mod) => (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setSelectedModule(mod.id)}
                    className={cn(
                      "flex-shrink-0 flex items-center gap-3 px-5 py-3 border rounded-full transition-all whitespace-nowrap",
                      selectedModule === mod.id
                        ? "bg-gold/10 border-gold shadow-[0_0_10px_rgba(204,164,59,0.3)] text-white font-bold"
                        : "bg-white/5 border-white/10 text-textMuted hover:bg-white/10"
                    )}
                  >
                    {mod.icono} <span className="text-sm">{mod.titulo}</span>
                  </button>
                ))}
              </div>

              {filteredLessons.length > 0 ? (
                <>
                  <div className="mb-6 flex justify-between items-end">
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">{activeLesson.titulo}</h2>
                      {isPremium ? (
                        <span className="text-textMuted flex items-center gap-2 text-sm">
                          <Trophy size={16} className="text-gold" /> Módulo actualizado. Tú eres Premium.
                        </span>
                      ) : (
                        <span className="text-textMuted flex items-center gap-2 text-sm">
                          <PlayCircle size={16} className="text-gray-400" /> Viendo versión gratuita con anuncios.
                        </span>
                      )}
                    </div>
                  </div>

                  <LessonPlayer videoSrc={activeLesson.video} isPremium={isPremium} />

                  <div className="mt-8 bg-black/30 border border-white/10 rounded-2xl p-6">
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <Edit3 size={18} /> Apuntes Rápidos
                    </h4>
                    <textarea
                      value={personalNote}
                      onChange={(e) => setPersonalNote(e.target.value)}
                      disabled={!isPremium}
                      placeholder={isPremium ? "Escribe tus reflexiones de esta lección sin pausar el video..." : "El plan Free no incluye toma de notas. ¡Mejora tu plan!"}
                      className="w-full bg-white/5 border border-white/5 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-gold resize-none h-24 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    ></textarea>
                    <div className="flex justify-end mt-3">
                      <button
                        type="button"
                        disabled={!isPremium}
                        className="px-5 py-2 text-sm bg-white/10 hover:bg-gold hover:text-darker border border-white/10 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Guardar Notas
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center border border-white/10 rounded-3xl bg-white/5">
                  <PlayCircle size={48} className="mx-auto text-white/30 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Aún no hay lecciones aquí</h3>
                  <p className="text-textMuted">Pronto agregaremos nuevo contenido a este módulo.</p>
                </div>
              )}
            </>
          )}

          {activeTab === "notas" && (
            <div className="p-6 text-center border border-white/10 rounded-3xl bg-white/5 h-64 flex flex-col justify-center">
              <Edit3 size={40} className="mx-auto text-gold mb-4" />
              <h3 className="text-xl font-bold text-white">Libreta de Aprendizaje</h3>
              <p className="text-textMuted mt-2">Aquí aparecerán todas tus notas divididas por módulo.</p>
            </div>
          )}

          {activeTab === "certificados" && (
            <div className="p-6 text-center border border-white/10 rounded-3xl bg-white/5 h-64 flex flex-col justify-center">
              <Award size={40} className="mx-auto text-gold mb-4" />
              <h3 className="text-xl font-bold text-white">Logros Desbloqueados</h3>
              <p className="text-textMuted mt-2">Termina el 100% de un módulo para obtener tu aval digital.</p>
            </div>
          )}

          {activeTab === "comunidad" && (
            <div className="p-6 text-center border border-transparent rounded-3xl bg-gradient-to-br from-gold/20 to-darker h-64 flex flex-col justify-center relative overflow-hidden">
              <div className="relative z-10">
                <Users size={40} className="mx-auto text-gold mb-4" />
                <h3 className="text-2xl font-bold text-white">Red Global Privada</h3>
                <p className="text-white/80 mt-2 max-w-md mx-auto">
                  Conecta con cientos de líderes y haz networking del más alto nivel.
                </p>
                <button
                  type="button"
                  className="mt-6 px-6 py-2 bg-gold text-darker font-bold rounded-lg hover:scale-105 transition-transform shadow-lg"
                >
                  Abrir Foro
                </button>
              </div>
            </div>
          )}

          {activeTab === "perfil" && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <UserIcon className="text-gold" /> Mi Panel
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-textMuted mb-2">Foto de Perfil</label>
                    <div className="flex items-center gap-6">
                      <div className="relative w-24 h-24 rounded-full bg-gold/10 flex items-center justify-center border-2 border-gold/30 text-3xl font-bold text-gold shadow-lg group overflow-hidden">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          getInitials(profileName || "Usuario")
                        )}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                          <Camera size={24} className="text-white" />
                          <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUpdatingProfile} />
                        </label>
                      </div>
                      <div className="text-sm text-textMuted">
                        <p>Haz clic en la imagen para subir una nueva.</p>
                        <p className="text-xs mt-1">Recomendado: 400x400px (Max 2MB)</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-textMuted mb-2">Nombre Completo</label>
                    <input 
                      type="text" 
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-textMuted mb-2">Correo Electrónico</label>
                    <input 
                      type="email" 
                      defaultValue={user?.email}
                      disabled
                      className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-white/50 cursor-not-allowed"
                    />
                  </div>
                  
                  {profileMessage && (
                    <div className={cn("p-3 rounded-lg text-sm font-medium", profileMessage.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20")}>
                      {profileMessage.text}
                    </div>
                  )}

                  <button 
                    onClick={handleUpdateProfile}
                    disabled={isUpdatingProfile}
                    className="px-6 py-3 bg-gold hover:bg-goldHover text-darker font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isUpdatingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    Guardar Cambios
                  </button>
                </div>

                <div className="bg-black/30 rounded-2xl p-6 border border-white/5 h-fit">
                  <h3 className="text-lg font-bold text-white mb-4">Información de Suscripción</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between pb-4 border-b border-white/5">
                      <span className="text-textMuted">Plan actual</span>
                      <span className="text-gold font-bold uppercase">{user?.plan || "Free"}</span>
                    </div>
                    <div className="flex justify-between pb-4 border-b border-white/5">
                      <span className="text-textMuted">Estado</span>
                      <span className="text-green-400 font-medium">Activo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textMuted">Miembro desde</span>
                      <span className="text-white">
                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Hoy"}
                      </span>
                    </div>
                  </div>
                  
                  {user?.plan === PLANS.FREE ? (
                    <button className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all border border-white/10">
                      Mejorar mi Plan
                    </button>
                  ) : (
                    <button className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 text-white/70 font-medium rounded-xl transition-all border border-white/5 text-sm">
                      Gestionar Suscripción
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
