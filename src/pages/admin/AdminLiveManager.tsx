import { useState, useEffect } from "react";
import { Radio, Image as ImageIcon, Settings2, Save, Plus, Trash2, PlayCircle, StopCircle, Calendar, Clock, Monitor, Copy, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchLives, createLive, updateLive, deleteLive, setActiveLive as apiSetActiveLive, type LiveEvent } from "@/lib/api/stream/lives";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/toaster";

const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const tzAbbr = new Intl.DateTimeFormat("es", { timeZoneName: "short" })
  .formatToParts(new Date())
  .find(p => p.type === "timeZoneName")?.value || "";

function isoToLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("sv-SE").replace(" ", "T").slice(0, 16);
}

function highestPlan(plans: string[]): "free" | "individual" | "vip" {
  if (plans.includes("vip")) return "vip";
  if (plans.includes("individual")) return "individual";
  return "free";
}

const AdminLiveManager = () => {
  const [activeTab, setActiveTab] = useState<"editor" | "rooms">("editor");
  const [lives, setLives] = useState<LiveEvent[]>([]);
  const [activeLive, setActiveLive] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<LiveEvent>>({
    title: "",
    description: "",
    stream_live_input_id: "",
    starts_at: "",
    background_image_url: "",
    allowed_plans: ["vip"],
    status: "scheduled",
    required_plan: "vip",
    duration_minutes: null,
    is_active: false,
  });

  useEffect(() => { loadData(); }, []);

  const uploadBackground = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("La imagen no puede superar 5MB"); return; }
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `lives/${Date.now()}.${ext}`;
    try {
      toast.info("Subiendo imagen...");
      const { error: uploadError } = await supabase.storage
        .from("backgrounds")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from("backgrounds")
        .getPublicUrl(filePath);
      setFormData(prev => ({ ...prev, background_image_url: publicUrl }));
      toast.success("Imagen subida");
    } catch (err) {
      console.error(err);
      toast.error("Error al subir la imagen. ¿Ejecutaste las policies de RLS del bucket 'backgrounds'?");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchLives();
      setLives(data);
      if (data.length > 0) {
        setActiveLive(data[0]);
        setFormData(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectRoom = async (live: LiveEvent) => {
    const { data, error } = await supabase
      .from("lives")
      .select("*")
      .eq("id", live.id)
      .single();
    if (data && !error) {
      const fresh = data as LiveEvent;
      setActiveLive(fresh);
      setFormData(fresh);
    } else {
      setActiveLive(live);
      setFormData(live);
    }
    setActiveTab("editor");
  };

  const handleSave = async () => {
    if (!activeLive) return;
    const plans = formData.allowed_plans || ["vip"];
    const payload = {
      ...formData,
      required_plan: highestPlan(plans),
    };
    try {
      setIsSaving(true);
      const updated = await updateLive(activeLive.id, payload);
      setLives(prev => prev.map(l => l.id === updated.id ? updated : l));
      setActiveLive(updated);
      setFormData(updated);
      toast.success("Sala guardada", { description: "Los cambios se aplicaron correctamente." });
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLive = async (forceLive: boolean) => {
    if (!activeLive) return;
    try {
      setIsSaving(true);
      if (forceLive) {
        for (const live of lives) {
          if (live.status === "live" && live.id !== activeLive.id) {
            await updateLive(live.id, { status: "scheduled" });
          }
        }
      }
      const updated = await updateLive(activeLive.id, { status: forceLive ? "live" : "scheduled" });
      setLives(prev => prev.map(l => l.id === updated.id ? updated : l).map(l => forceLive && l.id !== updated.id ? { ...l, status: "scheduled" as const } : l));
      setActiveLive(updated);
      setFormData(prev => ({ ...prev, status: forceLive ? "live" : "scheduled" }));
      toast.success(forceLive ? "Sala EN VIVO" : "Transmisión detenida");
    } catch (err) {
      console.error(err);
      toast.error("Error cambiando estado");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      setIsSaving(true);
      const newLive = await createLive({
        title: "Nuevo Evento",
        description: "",
        stream_live_input_id: "",
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        background_image_url: "",
        allowed_plans: ["vip"],
        status: "scheduled",
        required_plan: "vip",
        duration_minutes: null,
      });
      setLives(prev => [newLive, ...prev]);
      setActiveLive(newLive);
      setFormData(newLive);
      setActiveTab("editor");
      toast.success("Sala creada", { description: "Ahora podés configurar título, horario y fondo." });
    } catch (err) {
      console.error(err);
      toast.error("Error al crear sala");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar esta sala permanentemente?")) return;
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
          setFormData({
            title: "", description: "", stream_live_input_id: "", starts_at: "",
            background_image_url: "", allowed_plans: ["vip"], status: "scheduled",
            required_plan: "vip", duration_minutes: null,
          });
        }
      }
      toast.success("Sala eliminada");
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  if (loading) return <div className="text-white text-center py-20">Cargando salas...</div>;

  const isLive = formData.status === "live";

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Radio className="text-red-500" /> Gestor de En Vivo
          </h1>
          <p className="text-textMuted mt-1">Crea, programa y controla tus transmisiones en vivo para usuarios VIP.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCreateNew} disabled={isSaving}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors">
            <Plus size={18} /> Nueva Sala
          </button>
          {activeLive && (
            <button onClick={handleSave} disabled={isSaving}
              className="bg-gold hover:bg-goldHover text-darker font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50">
              <Save size={18} /> {isSaving ? "Guardando..." : "Guardar"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
        <button onClick={() => setActiveTab("editor")}
          className={cn("px-4 py-2 rounded-lg font-semibold text-sm transition-all", activeTab === "editor" ? "bg-white/10 text-white" : "text-textMuted hover:text-white")}>
          <Settings2 size={16} className="inline mr-2" />Editor
        </button>
        <button onClick={() => setActiveTab("rooms")}
          className={cn("px-4 py-2 rounded-lg font-semibold text-sm transition-all", activeTab === "rooms" ? "bg-white/10 text-white" : "text-textMuted hover:text-white")}>
          <Radio size={16} className="inline mr-2" />Salas ({lives.length})
        </button>
      </div>

      {activeTab === "editor" && activeLive && (
        <div className="space-y-6">
          {/* Información del Evento */}
          <div className="bg-darker border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Settings2 size={18} className="text-gold" /> Información del Evento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-textMuted">Título del evento</label>
                <input type="text" value={formData.title || ""}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-textMuted flex items-center gap-2">
                  Programado para
                  <span className="text-[10px] text-gold/60 font-mono bg-gold/10 px-1.5 py-0.5 rounded">{tzAbbr} · {userTimezone}</span>
                </label>
                <input type="datetime-local" value={isoToLocalDatetime(formData.starts_at)}
                  onChange={e => setFormData({ ...formData, starts_at: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold [color-scheme:dark]" />
                {formData.starts_at && (
                  <p className="text-[10px] text-textMuted/40 flex items-center gap-1">
                    <Clock size={10} /> Guardado en UTC:{' '}
                    {new Date(formData.starts_at).toISOString().replace("T", " ").slice(0, 19)}Z
                  </p>
                )}
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-semibold text-textMuted">Descripción</label>
                <textarea value={formData.description || ""}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold resize-none" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-textMuted">Planes con acceso</label>
                <div className="flex items-center gap-4 bg-black/50 border border-white/10 rounded-xl px-4 py-3 h-[50px]">
                  {["free", "individual", "vip"].map(plan => (
                    <label key={plan} className="flex items-center gap-2 cursor-pointer text-white text-sm">
                      <input type="checkbox" checked={formData.allowed_plans?.includes(plan as "free" | "individual" | "vip")}
                        onChange={e => {
                          const plans = formData.allowed_plans || [];
                          const p = plan as "free" | "individual" | "vip";
                          const next = e.target.checked ? [...plans, p] : plans.filter(x => x !== p);
                          setFormData({ ...formData, allowed_plans: next });
                        }}
                        className="accent-gold w-4 h-4" />
                      <span className="capitalize">{plan}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-textMuted/50">
                  El plan más alto seleccionado se usa como <code>required_plan</code> automáticamente.
                </p>
              </div>
            </div>
          </div>

          {/* Cloudflare Stream ID */}
          <div className="bg-darker border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Monitor size={18} className="text-gold" /> Configuración de Transmisión (OBS)
            </h3>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-textMuted">Cloudflare Live Input ID</label>
              <input type="text" placeholder="Ej: 595f2bfac6285d604cf136e049c37b08"
                value={formData.stream_live_input_id || ""}
                onChange={e => setFormData({ ...formData, stream_live_input_id: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold font-mono text-sm" />
            </div>

            <details className="mt-4 group">
              <summary className="text-sm text-gold font-semibold cursor-pointer hover:text-goldHover transition-colors flex items-center gap-2">
                <Clock size={14} /> ¿Cómo configurar OBS Studio?
              </summary>
              <div className="mt-4 p-4 bg-black/40 border border-white/10 rounded-xl space-y-3 text-sm text-white/80">
                <p>1. Ve a <strong>Cloudflare Dashboard → Stream → Live Inputs</strong></p>
                <p>2. Crea un nuevo "Live Input" y copia el <strong>Input ID</strong> de arriba</p>
                <p>3. En OBS Studio ve a <strong>Configuración → Transmisión</strong>:</p>
                <div className="pl-4 space-y-1 text-textMuted">
                  <p>• Servicio: <strong>Custom...</strong></p>
                  <p>• Servidor: <span className="text-gold font-mono text-xs">rtmps://live.cloudflare.com:443/live/</span>
                    <button onClick={() => copyToClipboard("rtmps://live.cloudflare.com:443/live/", "Servidor RTMPS")}
                      className="inline ml-2 text-gold hover:text-goldHover"><Copy size={14} className="inline" /></button>
                  </p>
                  <p>• Clave de transmisión: <span className="text-gold font-mono text-xs">[el Input ID de arriba]</span></p>
                </div>
                <p>4. En OBS, para <strong>menor latencia</strong> ve a Configuración → Avanzado:</p>
                <div className="pl-4 space-y-1 text-textMuted">
                  <p>• Modo de reescalado: <strong>1920x1080</strong> o menor</p>
                  <p>• Intervalo de keyframe: <strong>1 segundo</strong></p>
                  <p>• Control de tasa: <strong>CBR</strong>, bitrate 4000-8000 Kbps</p>
                  <p>• FPS: <strong>30</strong> (no 60)</p>
                </div>
                <p>5. En Cloudflare Dashboard → Stream → Live Input → editar el input y activar:</p>
                <div className="pl-4 space-y-1 text-textMuted">
                  <p>✅ <strong>"Low-Latency HLS"</strong> (reduce latencia a ~3-5s)</p>
                  <p>✅ <strong>"WebRTC"</strong> (reduce latencia a &lt;1s — ideal para interactuar en chat)</p>
                </div>
                <p>6. Haz clic en <strong>"Iniciar transmisión"</strong> en OBS</p>
                <p>7. Cuando estés listo, activa <strong>"Forzar EN VIVO"</strong> abajo</p>
              </div>
            </details>
          </div>

          {/* Background Image */}
          <div className="bg-darker border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ImageIcon size={18} className="text-gold" /> Fondo de Sala de Espera
            </h3>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-semibold text-textMuted">URL de la imagen</label>
                <input type="text" value={formData.background_image_url || ""}
                  onChange={e => setFormData({ ...formData, background_image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold text-sm" />
                <div className="relative">
                  <div
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-gold"); }}
                    onDragLeave={e => { e.currentTarget.classList.remove("border-gold"); }}
                    onDrop={async e => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("border-gold");
                      const file = e.dataTransfer.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith("image/")) { toast.error("Solo imágenes"); return; }
                      await uploadBackground(file);
                    }}
                    className="mt-2 border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-gold/50 transition-colors"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      id="bg-upload"
                      className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        await uploadBackground(file);
                        e.target.value = "";
                      }}
                    />
                    <label htmlFor="bg-upload" className="cursor-pointer block">
                      <Upload size={24} className="mx-auto text-textMuted mb-2" />
                      <p className="text-sm text-textMuted">Arrastra una imagen o <span className="text-gold font-semibold">haz clic</span> para subir</p>
                      <p className="text-[10px] text-textMuted/50 mt-1">Recomendado: 1920×1080, max 5MB</p>
                    </label>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-64 h-48 rounded-xl border border-white/20 overflow-hidden bg-black shrink-0 relative flex items-center justify-center">
                {formData.background_image_url ? (
                  <img src={formData.background_image_url} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                ) : (
                  <ImageIcon size={32} className="text-white/20" />
                )}
                <div className="absolute bottom-2 left-2 z-10">
                  <span className="text-[10px] font-bold bg-black/80 px-2 py-1 rounded-lg text-white/80 backdrop-blur-md border border-white/10">Vista Previa</span>
                </div>
              </div>
            </div>
          </div>

          {/* Control de Transmisión */}
          <div className={cn("border rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors", isLive ? "bg-red-500/10 border-red-500/30" : "bg-darker border-white/10")}>
            <div>
              <h3 className={cn("text-lg font-bold", isLive ? "text-red-400" : "text-white")}>
                Control de Transmisión {isLive && "(¡EN VIVO!)"}
              </h3>
              <p className="text-sm text-textMuted max-w-md mt-1">
                {isLive
                  ? "La transmisión está activa. Los usuarios VIP pueden ver el evento en vivo."
                  : "Activa la sala para que los usuarios VIP vean la transmisión. Solo puede haber 1 sala activa a la vez."}
              </p>
              {formData.starts_at && !isLive && (
                <p className="text-xs text-gold mt-2 flex items-center gap-1">
                  <Calendar size={12} /> Programado: {new Date(formData.starts_at).toLocaleString("es-CO")}
                </p>
              )}
            </div>
            {isLive ? (
              <div className="flex gap-2">
                <button onClick={() => handleToggleLive(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 whitespace-nowrap transition-colors">
                  <StopCircle size={20} /> Detener
                </button>
                <button onClick={async () => {
                  if (!window.confirm("¿Finalizar esta sala? Pasara a estado 'ended' y no aparecerá más como próxima sala.")) return;
                  try {
                    const updated = await updateLive(activeLive!.id, { status: "ended" });
                    setLives(prev => prev.map(l => l.id === updated.id ? updated : l).filter(l => l.status !== "ended"));
                    setActiveLive(null);
                    setFormData({ title: "", description: "", stream_live_input_id: "", starts_at: "", background_image_url: "", allowed_plans: ["vip"], status: "scheduled", required_plan: "vip", duration_minutes: null });
                    toast.success("Sala finalizada");
                  } catch (err) { console.error(err); toast.error("Error"); }
                }}
                  className="bg-red-800/50 hover:bg-red-800 text-red-400 font-bold px-6 py-3 rounded-xl flex items-center gap-2 whitespace-nowrap transition-colors border border-red-800/30">
                  <StopCircle size={20} /> Finalizar
                </button>
              </div>
            ) : (
              <button onClick={() => handleToggleLive(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 whitespace-nowrap shadow-lg shadow-red-900/50 transition-colors">
                <PlayCircle size={20} /> Forzar EN VIVO
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === "editor" && !activeLive && (
        <div className="text-center py-20 text-textMuted bg-darker rounded-2xl border border-white/5">
          <Radio size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold text-white/70">No hay salas</p>
          <p className="text-sm mt-1">Crea una nueva sala para empezar.</p>
        </div>
      )}

      {activeTab === "rooms" && (
        <div className="space-y-3">
          {lives.length === 0 ? (
            <div className="text-center py-12 text-textMuted bg-darker rounded-xl border border-white/5">
              No hay salas creadas
            </div>
          ) : (
            lives.map(live => (
              <div key={live.id}
                className={cn("bg-black/50 border rounded-xl p-4 flex items-center justify-between group transition-all cursor-pointer hover:bg-white/[0.03]", activeLive?.id === live.id ? "border-gold/40 bg-gold/5" : "border-white/10")}
                onClick={() => selectRoom(live)}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-3 h-3 rounded-full shrink-0",
                    live.status === "live" ? "bg-red-500 animate-pulse shadow-[0_0_10px_red]" :
                    live.starts_at ? "bg-gold/50" : "bg-gray-600")} />
                  <div>
                    <h4 className="text-white font-bold">{live.title || "Sin título"}</h4>
                    <div className="flex flex-wrap gap-2 mt-1 items-center">
                      {live.starts_at && (
                        <span className="text-[10px] text-white/40 flex items-center gap-1">
                          <Calendar size={10} /> {new Date(live.starts_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {live.allowed_plans?.map(plan => (
                        <span key={plan} className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/60">{plan}</span>
                      ))}
                      {live.status === "live" && <span className="text-[10px] text-red-400 font-bold">EN VIVO</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={async e => {
                    e.stopPropagation();
                    try {
                      const updated = await apiSetActiveLive(live.id);
                      setLives(prev => prev.map(l => ({ ...l, is_active: l.id === updated.id })));
                      setActiveLive(updated);
                      setFormData(updated);
                      toast.success(`"${live.title || "Sala"}" activada`);
                    } catch (err) {
                      console.error(err);
                      toast.error("Error al activar sala");
                    }
                  }}
                    className={cn("p-2 rounded-lg transition-colors", live.is_active ? "text-gold bg-gold/10" : "text-white/30 hover:text-gold hover:bg-gold/10")}
                    title={live.is_active ? "Sala activa" : "Activar sala"}>
                    <Radio size={16} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(live.id); }}
                    className="p-2 text-red-500/50 hover:text-red-400 bg-red-500/5 rounded-lg hover:bg-red-500/20 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminLiveManager;
