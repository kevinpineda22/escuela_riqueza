import { useState, useEffect } from "react";
import { Radio, Image as ImageIcon, Settings2, PlayCircle, Save, Plus, Trash2, Edit2, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchLives, createLive, updateLive, deleteLive, type LiveEvent } from "@/lib/api/stream/lives";

const AdminLiveManager = () => {
  const [activeTab, setActiveTab] = useState<"current" | "settings">("current");
  const [lives, setLives] = useState<LiveEvent[]>([]);
  const [activeLive, setActiveLive] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Formulario temporal
  const [formData, setFormData] = useState<Partial<LiveEvent>>({
    title: "",
    description: "",
    stream_uid: "",
    background_image_url: "",
    allowed_plans: ["vip"],
    is_active: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchLives();
      setLives(data);
      const active = data.find(l => l.is_active);
      if (active) {
        setActiveLive(active);
        setFormData(active);
      } else if (data.length > 0) {
        setActiveLive(data[0]);
        setFormData(data[0]);
      } else {
        // Crear uno por defecto si no hay ninguno
        const defaultLive = await createLive({
          title: "Inmersión VIP Mensual",
          description: "Sesión en vivo de este mes.",
          stream_uid: "",
          background_image_url: "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/1f8c5d3a-402d-4729-0e17-f179f416f900/public",
          allowed_plans: ["vip"],
          is_active: false
        });
        setLives([defaultLive]);
        setActiveLive(defaultLive);
        setFormData(defaultLive);
      }
    } catch (err) {
      console.error(err);
      alert("Error cargando eventos en vivo");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activeLive) return;
    try {
      setIsSaving(true);
      const updated = await updateLive(activeLive.id, formData);
      setLives(lives.map(l => l.id === updated.id ? updated : l));
      setActiveLive(updated);
      alert("Guardado correctamente ✅");
    } catch (err) {
      console.error(err);
      alert("Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLive = async (forceActive: boolean) => {
    if (!activeLive) return;
    try {
      setIsSaving(true);
      // Si vamos a encender este, apagamos los demás
      if (forceActive) {
        for (const live of lives) {
          if (live.is_active && live.id !== activeLive.id) {
            await updateLive(live.id, { is_active: false });
          }
        }
      }
      const updated = await updateLive(activeLive.id, { is_active: forceActive });
      
      const newLives = lives.map(l => {
        if (l.id === updated.id) return updated;
        if (forceActive) return { ...l, is_active: false };
        return l;
      });
      
      setLives(newLives);
      setActiveLive(updated);
      setFormData({...formData, is_active: forceActive});
    } catch (err) {
      console.error(err);
      alert("Error cambiando estado");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      setIsSaving(true);
      const newLive = await createLive({
        title: "Nuevo Evento " + new Date().toLocaleDateString(),
        description: "",
        stream_uid: "",
        background_image_url: "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/1f8c5d3a-402d-4729-0e17-f179f416f900/public",
        allowed_plans: ["vip"],
        is_active: false
      });
      setLives([newLive, ...lives]);
      setActiveLive(newLive);
      setFormData(newLive);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta sala?")) return;
    try {
      await deleteLive(id);
      const remaining = lives.filter(l => l.id !== id);
      setLives(remaining);
      if (activeLive?.id === id) {
        if (remaining.length > 0) {
          setActiveLive(remaining[0]);
          setFormData(remaining[0]);
        } else {
          setActiveLive(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-white text-center py-20">Cargando salas en vivo...</div>;
  
  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Radio className="text-red-500 animate-pulse" /> Gestor de En Vivo
          </h1>
          <p className="text-textMuted mt-1">Configura la sala de espera y la transmisión para los usuarios VIP.</p>
        </div>
        <button 
          disabled={!activeLive || isSaving}
          onClick={handleSave}
          className="bg-gold hover:bg-goldHover text-darker font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <Save size={18} /> {isSaving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mb-6 border-b border-white/10 pb-4 justify-between">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab("current")}
            className={cn("px-4 py-2 rounded-lg font-semibold text-sm transition-all", activeTab === "current" ? "bg-white/10 text-white" : "text-textMuted hover:text-white")}
          >
            Editor de Salas
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            className={cn("px-4 py-2 rounded-lg font-semibold text-sm transition-all", activeTab === "settings" ? "bg-white/10 text-white" : "text-textMuted hover:text-white")}
          >
            Gestor de Eventos
          </button>
        </div>
      </div>

      {activeTab === "current" && activeLive && (
        <div className="space-y-6">
          <div className="bg-darker border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Settings2 size={18} className="text-gold"/> Información del Evento</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-textMuted">Título Principal (Pantalla de Espera)</label>
                <input 
                  type="text" 
                  value={formData.title || ""}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-textMuted">Planes con acceso</label>
                <div className="flex items-center gap-4 bg-black/50 border border-white/10 rounded-xl px-4 py-3 h-[50px]">
                  {["free", "individual", "vip"].map((plan) => (
                    <label key={plan} className="flex items-center gap-2 cursor-pointer text-white text-sm">
                      <input 
                        type="checkbox" 
                        checked={formData.allowed_plans?.includes(plan as any)}
                        onChange={(e) => {
                          const plans = formData.allowed_plans || [];
                          if (e.target.checked) {
                            setFormData({...formData, allowed_plans: [...plans, plan as any]});
                          } else {
                            setFormData({...formData, allowed_plans: plans.filter(p => p !== plan)});
                          }
                        }}
                        className="accent-gold w-4 h-4"
                      />
                      <span className="capitalize">{plan}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-textMuted">Cloudflare Stream ID o Live Input ID</label>
                <input 
                  type="text" 
                  placeholder="Ej: 595f2bfac6285d604cf136e049c37b08"
                  value={formData.stream_uid || ""}
                  onChange={(e) => setFormData({...formData, stream_uid: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold font-mono text-sm"
                />
                <p className="text-xs text-textMuted mt-1">
                  1. Crea un "Live Input" en Cloudflare Stream.<br/>
                  2. Copia la URL RTMP y la Key y pégalas en OBS Studio.<br/>
                  3. Copia el "Input ID" y pégalo aquí.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-darker border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><ImageIcon size={18} className="text-gold"/> Fondo de la Sala de Espera</h3>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-semibold text-textMuted">URL de la Imagen</label>
                <input 
                  type="text" 
                  value={formData.background_image_url || ""}
                  onChange={(e) => setFormData({...formData, background_image_url: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold text-sm"
                />
              </div>
              <div className="w-full md:w-64 h-32 rounded-xl border border-white/20 overflow-hidden bg-black shrink-0 relative flex items-center justify-center">
                {formData.background_image_url && (
                  <img src={formData.background_image_url} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                )}
                <div className="relative z-10 flex items-center justify-center pointer-events-none">
                  <span className="text-xs font-bold bg-black/80 px-3 py-1.5 rounded-lg text-white backdrop-blur-md border border-white/10">Vista Previa</span>
                </div>
              </div>
            </div>
          </div>

          <div className={cn("border rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors", formData.is_active ? "bg-red-500/10 border-red-500/30" : "bg-darker border-white/10")}>
            <div>
              <h3 className={cn("text-lg font-bold", formData.is_active ? "text-red-400" : "text-white")}>
                Control de Transmisión {formData.is_active && "(¡EN VIVO!)"}
              </h3>
              <p className="text-sm text-textMuted max-w-md mt-1">Al activar la sala, el reproductor conectará con OBS Studio y los alumnos verán el video. Solo puede haber 1 sala activa a la vez.</p>
            </div>
            
            {formData.is_active ? (
              <button 
                onClick={() => handleToggleLive(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 whitespace-nowrap transition-colors"
              >
                <StopCircle size={20} /> Detener Transmisión
              </button>
            ) : (
              <button 
                onClick={() => handleToggleLive(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 whitespace-nowrap shadow-lg shadow-red-900/50 transition-colors"
              >
                <PlayCircle size={20} /> Forzar EN VIVO Ahora
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-darker p-4 rounded-xl border border-white/10">
            <div>
              <h3 className="text-white font-bold">Listado de Salas</h3>
              <p className="text-textMuted text-sm">Gestiona o crea nuevas salas de transmisión.</p>
            </div>
            <button 
              onClick={handleCreateNew}
              disabled={isSaving}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors"
            >
              <Plus size={16} /> Crear Sala
            </button>
          </div>

          <div className="grid gap-3">
            {lives.map(live => (
              <div key={live.id} className="bg-black/50 border border-white/10 rounded-xl p-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={cn("w-3 h-3 rounded-full", live.is_active ? "bg-red-500 animate-pulse shadow-[0_0_10px_red]" : "bg-gray-600")} />
                  <div>
                    <h4 className="text-white font-bold">{live.title}</h4>
                    <div className="flex gap-2 mt-1">
                      {live.allowed_plans?.map(plan => (
                         <span key={plan} className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                           {plan}
                         </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setActiveLive(live);
                      setFormData(live);
                      setActiveTab("current");
                    }}
                    className="p-2 text-white/50 hover:text-white bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(live.id)}
                    className="p-2 text-red-500/50 hover:text-red-400 bg-red-500/5 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            
            {lives.length === 0 && (
              <div className="text-center py-12 text-textMuted bg-darker rounded-xl border border-white/5">
                No hay salas creadas
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLiveManager;
