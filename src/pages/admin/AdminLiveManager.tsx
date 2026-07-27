import { useState, useEffect } from "react";
import { Radio, Image as ImageIcon, Settings2, Save, Plus, Trash2, PlayCircle, StopCircle, Calendar, Clock, Monitor, Copy, Upload, Download, Video, Info, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchLives, fetchEndedLives, fetchRecording, createLive, updateLive, deleteLive, setActiveLive as apiSetActiveLive, deactivateAllLives, checkLiveInputStatus, archiveRecording, fetchRecordingUrl, type LiveEvent } from "@/lib/api/stream/lives";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/api/client";
import { toast } from "@/components/ui/toaster";
import RecordingPlayer from "@/components/feature/RecordingPlayer";

const CF_SUBDOMAIN = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN || "";
const PRESET_INPUT_IDS = [
  { label: "Principal (950f6b7...)", value: "950f6b77844e5a369bbeea208b2c428e" },
];

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
  const [activeTab, setActiveTab] = useState<"editor" | "rooms" | "ended">("editor");
  const [lives, setLives] = useState<LiveEvent[]>([]);
  const [endedLives, setEndedLives] = useState<LiveEvent[]>([]);
  const [activeLive, setActiveLive] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [customInputId, setCustomInputId] = useState(false);
  const [obsConnected, setObsConnected] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<LiveEvent>>({
    title: "",
    description: "",
    stream_live_input_id: "",
    recording_stream_uid: "",
    starts_at: "",
    background_image_url: "",
    allowed_plans: ["vip"],
    status: "scheduled",
    required_plan: "vip",
    duration_minutes: null,
    is_active: false,
    is_paused: false,
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!activeLive?.stream_live_input_id || activeLive.status === "ended") return;
    let failCount = 0;
    const check = async () => {
      const { connected, isError, disabled } = await checkLiveInputStatus(activeLive.stream_live_input_id!);
      if (disabled) { clearInterval(poll); return; }
      if (isError) {
        failCount++;
        if (failCount >= 3) { clearInterval(poll); return; }
      } else {
        failCount = 0;
      }
      setObsConnected(prev => connected !== prev ? connected : prev);

      if (connected && activeLive.status === "scheduled") {
        try {
          const updated = await updateLive(activeLive.id, { status: "live", is_paused: false });
          setLives(prev => prev.map(l => l.id === updated.id ? updated : l));
          setActiveLive(updated);
          setFormData(prev => ({ ...prev, status: "live" }));
          toast.success("Transmisión detectada. Sala ahora EN VIVO.");
        } catch (err) {
          console.error(err);
        }
      }
    };
    const poll = setInterval(check, 10000);
    check();
    return () => clearInterval(poll);
  }, [activeLive?.id, activeLive?.stream_live_input_id, activeLive?.status]);

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
      const [active, ended] = await Promise.all([fetchLives(), fetchEndedLives()]);
      setLives(active);
      setEndedLives(ended);
      // Seleccionar la sala activa (is_active=true), o la primera si ninguna está activa
      const activeRoom = active.find(l => l.is_active) || active[0] || null;
      if (activeRoom) {
        setActiveLive(activeRoom);
        setFormData(activeRoom);
        setCustomInputId(!PRESET_INPUT_IDS.some(p => p.value === activeRoom.stream_live_input_id));
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
      setCustomInputId(!PRESET_INPUT_IDS.some(p => p.value === fresh.stream_live_input_id));
    } else {
      setActiveLive(live);
      setFormData(live);
      setCustomInputId(!PRESET_INPUT_IDS.some(p => p.value === live.stream_live_input_id));
    }
    setActiveTab("editor");
  };

  const handleDownloadRecording = async (videoUid: string) => {
    toast.loading("Verificando estado de la grabación...", { id: `dl-${videoUid}` });
    try {
      const res = await authedFetch("/api/stream/download-status", {
        method: "POST",
        body: JSON.stringify({ video_uid: videoUid })
      });
      
      if (!res.ok) {
        // Fallback local: Si la API de Vercel no está corriendo localmente (da 502),
        // abrimos la pestaña directa — solo si tenemos el subdominio configurado.
        toast.dismiss(`dl-${videoUid}`);
        openDownloadFallback(videoUid);
        return;
      }

      const data = await res.json();

      if (data.status === "ready" && data.url) {
        toast.dismiss(`dl-${videoUid}`);
        window.open(data.url, "_blank");
      } else if (data.status === "error") {
        toast.error("Cloudflare no pudo generar el MP4", { description: "Volvé a intentar en unos minutos.", id: `dl-${videoUid}`, duration: 5000 });
      } else {
        // 'inprogress' (o recién habilitada): Cloudflare está generando el MP4.
        toast.loading(`Cloudflare está generando el MP4... ${Math.round(data.percentComplete)}%`, { id: `dl-${videoUid}`, duration: 6000 });
      }
    } catch (error) {
      console.error("Error comprobando descarga", error);
      toast.dismiss(`dl-${videoUid}`);
      // Fallback en caso de error de red
      openDownloadFallback(videoUid);
    }
  };

  const openDownloadFallback = (videoUid: string) => {
    if (!CF_SUBDOMAIN) {
      toast.error("No se pudo abrir la descarga", { description: "Falta configurar VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN." });
      return;
    }
    window.open(`https://${CF_SUBDOMAIN}/${videoUid}/downloads/default.mp4`, "_blank");
  };

  // Descarga de una grabación ya archivada en R2 (URL firmada de vida corta).
  const handleDownloadR2 = async (liveId: string) => {
    toast.loading("Generando enlace de descarga...", { id: `dl-r2-${liveId}` });
    const url = await fetchRecordingUrl(liveId);
    toast.dismiss(`dl-r2-${liveId}`);
    if (url) window.open(url, "_blank");
    else toast.error("No se pudo generar el enlace de descarga");
  };

  // Archiva la grabación en R2 (copia desde Stream + borra de Stream) para ahorrar costos.
  const handleArchive = async (live: LiveEvent) => {
    if (!live.recording_stream_uid) {
      toast.error("Primero vinculá la grabación (Obtener grabación) antes de archivar");
      return;
    }
    setArchivingId(live.id);
    toast.loading("Archivando en R2...", { id: `arch-${live.id}` });
    const result = await archiveRecording(live.id, live.recording_stream_uid);
    setArchivingId(null);

    if (result.status === "archived") {
      toast.success("Grabación archivada en R2 y borrada de Stream", {
        id: `arch-${live.id}`,
        description: "Ya no genera costo recurrente en Cloudflare Stream.",
      });
      const ended = await fetchEndedLives();
      setEndedLives(ended);
    } else if (result.status === "processing") {
      toast.info(`Cloudflare todavía está generando el MP4... ${Math.round(result.percent)}%`, {
        id: `arch-${live.id}`,
        description: "Reintentá en unos minutos.",
        duration: 6000,
      });
    } else {
      toast.error(result.message, { id: `arch-${live.id}` });
    }
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

  const handleToggleLive = async (goingLive: boolean) => {
    if (!activeLive) return;
    try {
      setIsSaving(true);
      if (goingLive) {
        for (const live of lives) {
          if (live.status === "live" && !live.is_paused && live.id !== activeLive.id) {
            await updateLive(live.id, { status: "scheduled", is_paused: false });
          }
        }
      }
      const updated = await updateLive(activeLive.id, {
        status: goingLive ? "live" : "scheduled",
        is_paused: false,
      });
      setLives(prev => prev.map(l => l.id === updated.id ? updated : l).map(l => goingLive && l.id !== updated.id ? { ...l, status: "scheduled" as const, is_paused: false } : l));
      setActiveLive(updated);
      setFormData(prev => ({ ...prev, status: goingLive ? "live" : "scheduled", is_paused: false }));
      if (goingLive) toast.success("Sala EN VIVO");
      else toast.success("Sala Programada");
    } catch (err) {
      console.error(err);
      toast.error("Error cambiando estado");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePauseResume = async (pause: boolean) => {
    if (!activeLive) return;
    try {
      setIsSaving(true);
      const updated = await updateLive(activeLive.id, { is_paused: pause });
      setLives(prev => prev.map(l => l.id === updated.id ? updated : l));
      setActiveLive(updated);
      setFormData(prev => ({ ...prev, is_paused: pause }));
      if (pause) toast.success("Transmisión Pausada");
      else toast.success("Transmisión Reanudada");
    } catch (err) {
      console.error(err);
      toast.error("Error al pausar/reanudar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      setIsSaving(true);
      // Al crear nueva sala, usar el Input ID principal por defecto
      const defaultInputId = PRESET_INPUT_IDS[0]?.value || "";
      setCustomInputId(false);
      const newLive = await createLive({
        title: "Nuevo Evento",
        description: "",
        stream_live_input_id: defaultInputId,
        recording_stream_uid: "",
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        background_image_url: "",
        allowed_plans: ["vip"],
        status: "scheduled",
        required_plan: "vip",
        duration_minutes: null,
      });
      // Auto-activar la nueva sala (desactiva cualquier otra que estuviera activa)
      const activated = await apiSetActiveLive(newLive.id);
      setLives(prev => [activated, ...prev.filter(l => l.id !== activated.id).map(l => ({ ...l, is_active: false }))]);
      setActiveLive(activated);
      setFormData(activated);
      setActiveTab("editor");
      toast.success("Sala creada y activada", { description: "Ya está visible para los usuarios en /vip-live." });
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
            title: "", description: "", stream_live_input_id: PRESET_INPUT_IDS[0]?.value || "", starts_at: "",
            background_image_url: "", allowed_plans: ["vip"], status: "scheduled",
            required_plan: "vip", duration_minutes: null, is_active: false, is_paused: false,
          });
          setCustomInputId(false);
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

  if (loading) return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="animate-pulse space-y-6">
        <div className="flex justify-between items-start mb-8">
          <div className="space-y-3">
            <div className="h-8 w-64 bg-white/10 rounded-lg" />
            <div className="h-4 w-48 bg-white/5 rounded-lg" />
          </div>
          <div className="h-10 w-28 bg-white/10 rounded-xl" />
        </div>
        <div className="h-12 bg-white/5 rounded-xl" />
        <div className="h-64 bg-white/5 rounded-2xl" />
        <div className="h-48 bg-white/5 rounded-2xl" />
      </div>
    </div>
  );

  const isLive = formData.status === "live" && !formData.is_paused;

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Radio className="text-red-500" /> Gestor de En Vivo
          </h1>
          <p className="text-textMuted mt-1">Crea, programa y controla tus transmisiones en vivo para usuarios VIP.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={handleCreateNew} disabled={isSaving}
            className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 text-white px-3 sm:px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-colors">
            <Plus size={18} /> <span className="whitespace-nowrap">Nueva Sala</span>
          </button>
          {activeLive && (
            <button onClick={handleSave} disabled={isSaving}
              className="flex-1 md:flex-none bg-gold hover:bg-goldHover text-darker font-bold px-3 sm:px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              <Save size={18} /> <span className="whitespace-nowrap">{isSaving ? "Guardando..." : "Guardar"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto custom-scrollbar -mx-1 px-1">
        <button onClick={() => setActiveTab("editor")}
          className={cn("px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 flex items-center gap-2", activeTab === "editor" ? "bg-white/10 text-white" : "text-textMuted hover:text-white")}>
          <Settings2 size={16} />Editor
        </button>
        <button onClick={() => setActiveTab("rooms")}
          className={cn("px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 flex items-center gap-2", activeTab === "rooms" ? "bg-white/10 text-white" : "text-textMuted hover:text-white")}>
          <Radio size={16} />Salas ({lives.length})
        </button>
        <button onClick={() => setActiveTab("ended")}
          className={cn("px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 flex items-center gap-2", activeTab === "ended" ? "bg-white/10 text-white" : "text-textMuted hover:text-white")}>
          <Video size={16} />Finalizados ({endedLives.length})
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
                <div className="flex flex-wrap items-center gap-2 bg-black/50 border border-white/10 rounded-xl px-4 py-3 min-h-[50px]">
                  {["free", "individual", "vip"].map(plan => {
                    const isSelected = formData.allowed_plans?.includes(plan as "free" | "individual" | "vip");
                    return (
                      <button
                        key={plan}
                        type="button"
                        onClick={() => {
                          const plans = formData.allowed_plans || [];
                          const p = plan as "free" | "individual" | "vip";
                          const next = plans.includes(p) ? plans.filter(x => x !== p) : [...plans, p];
                          setFormData({ ...formData, allowed_plans: next });
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-bold transition-all border",
                          isSelected
                            ? plan === "free" ? "bg-green-500/15 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                              : plan === "individual" ? "bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                              : "bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]"
                            : "bg-white/5 text-white/40 border-white/10 hover:border-white/30 hover:text-white/70"
                        )}
                      >
                        {plan === "free" ? "Gratuito" : plan === "individual" ? "Individual" : "VIP"}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-textMuted/50 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold/50" />
                  El plan más alto seleccionado se usa como <code className="text-gold">required_plan</code> automáticamente.
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
              <label className="text-sm font-semibold text-textMuted flex items-center justify-between">
                Cloudflare Live Input ID
                {!customInputId && formData.stream_live_input_id === PRESET_INPUT_IDS[0]?.value && (
                  <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-mono">
                    ✓ Predeterminado
                  </span>
                )}
                {customInputId && (
                  <span className="text-[10px] bg-gold/10 text-gold border border-gold/20 px-2 py-0.5 rounded-full font-mono">
                    Personalizado
                  </span>
                )}
              </label>
              <select value={customInputId ? "__custom__" : (formData.stream_live_input_id || "")}
                onChange={e => {
                  if (e.target.value === "__custom__") {
                    setCustomInputId(true);
                    setFormData({ ...formData, stream_live_input_id: "" });
                  } else {
                    setCustomInputId(false);
                    setFormData({ ...formData, stream_live_input_id: e.target.value });
                  }
                }}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold font-mono text-sm appearance-none cursor-pointer">
                {PRESET_INPUT_IDS.map(p => (
                  <option key={p.value} value={p.value} className="bg-black text-white">{p.label}</option>
                ))}
                <option value="__custom__" className="bg-black text-white">— Personalizado —</option>
              </select>
              {customInputId && (
                <input type="text" placeholder="Ej: 595f2bfac6285d604cf136e049c37b08"
                  value={formData.stream_live_input_id || ""}
                  onChange={e => setFormData({ ...formData, stream_live_input_id: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold font-mono text-sm mt-2" />
              )}
              <p className="text-[10px] text-textMuted/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" /> 
                El Input ID principal está preconfigurado. Usá "Personalizado" solo si creaste otro Live Input en Cloudflare.
              </p>
            </div>

            <div className="space-y-2 mt-4 pt-4 border-t border-white/10">
              <label className="text-sm font-semibold text-textMuted">Grabación del directo (Cloudflare Stream UID)</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Automático después de finalizar"
                  value={formData.recording_stream_uid || ""}
                  onChange={e => setFormData({ ...formData, recording_stream_uid: e.target.value })}
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold font-mono text-sm" />
                <button onClick={async () => {
                  if (!activeLive?.stream_live_input_id) { toast.error("Primero configurá el Live Input ID"); return; }
                  toast.info("Buscando grabación en Cloudflare...");
                  const result = await fetchRecording(activeLive.stream_live_input_id);
                  if (result.recording_uid) {
                    setFormData(prev => ({ ...prev, recording_stream_uid: result.recording_uid }));
                    toast.success("Grabación encontrada y vinculada");
                  } else {
                    toast.error(result.message || "Cloudflare aún no ha generado la grabación. Intentá de nuevo en unos minutos.");
                  }
                }}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-3 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-colors shrink-0 whitespace-nowrap">
                  <Video size={14} /> Obtener grabación
                </button>
                {formData.recording_stream_uid && (
                  <button type="button" onClick={() => handleDownloadRecording(formData.recording_stream_uid!)}
                    className="bg-gold/10 hover:bg-gold/20 border border-gold/20 text-gold px-3 py-3 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-colors shrink-0">
                    <Download size={14} /> Descargar
                  </button>
                )}
              </div>
              <p className="text-[10px] text-textMuted/50">Al finalizar el directo, hacé clic en "Obtener grabación" para vincularla automáticamente. Sin necesidad de ir a Cloudflare.</p>
            </div>

            <details className="mt-4 group">
              <summary className="text-sm text-gold font-semibold cursor-pointer hover:text-goldHover transition-colors flex items-center gap-2">
                <Clock size={14} /> ¿Cómo configurar OBS Studio?
              </summary>
              <div className="mt-4 p-4 bg-black/40 border border-white/10 rounded-xl space-y-3 text-sm text-white/80">
                <p className="flex items-start gap-2 text-amber-300/90">
                  <span>⚠️</span>
                  <span>Lo MÁS importante para que el vivo no se corte: transmití por <strong>cable de red (ethernet)</strong>, nunca por WiFi, y usá un bitrate que tu subida aguante. Un corte de conexión = el vivo se congela y la grabación se fragmenta en videos sueltos.</span>
                </p>

                <p>1. En OBS: <strong>Configuración → Transmisión</strong></p>
                <div className="pl-4 space-y-1 text-textMuted">
                  <p>• Servicio: <strong>Personalizado (Custom)</strong></p>
                  <p>• Servidor: <span className="text-gold font-mono text-xs">rtmps://live.cloudflare.com:443/live/</span>
                    <button onClick={() => copyToClipboard("rtmps://live.cloudflare.com:443/live/", "Servidor RTMPS")}
                      className="inline ml-2 text-gold hover:text-goldHover"><Copy size={14} className="inline" /></button>
                  </p>
                  <p>• Clave de transmisión: <strong>el Live Input ID de arriba</strong></p>
                </div>

                <p>2. <strong>Configuración → Salida</strong> → Modo de salida: <strong>Avanzado</strong></p>
                <div className="pl-4 space-y-1 text-textMuted">
                  <p>• Codificador: <strong>x264</strong> (o NVENC H.264 si tenés GPU Nvidia)</p>
                  <p>• Control de tasa: <strong>CBR</strong></p>
                  <p>• Intervalo de keyframe: <strong>2</strong> (obligatorio — en <strong>Auto</strong> la grabación falla al codificar)</p>
                  <p>• Preajuste de uso de CPU: <strong>veryfast</strong> · Perfil: <strong>main</strong></p>
                </div>

                <p>3. Bitrate según tu subida REAL (medila antes en <span className="text-gold">fast.com</span>):</p>
                <div className="pl-4 space-y-1 text-textMuted">
                  <p>• Subida &lt; 5 Mbps → <strong>2.500 Kbps</strong> a 720p30</p>
                  <p>• Subida 5-10 Mbps → <strong>4.000 Kbps</strong> a 1080p30</p>
                  <p>• Subida &gt; 10 Mbps estable → <strong>6.000 Kbps</strong> a 1080p30</p>
                  <p className="text-amber-300/70">Regla de oro: el bitrate no debe pasar el <strong>50%</strong> de tu subida real. Ante la duda, bajalo: fluido y estable &gt; alta calidad que se corta.</p>
                </div>

                <p>4. <strong>Configuración → Video</strong></p>
                <div className="pl-4 space-y-1 text-textMuted">
                  <p>• Resolución de salida: <strong>1920x1080</strong> (o 1280x720 si tu subida es baja)</p>
                  <p>• FPS: <strong>30</strong> (nunca 60 para un vivo largo)</p>
                </div>

                <p>5. (Opcional) Menor latencia: en el Live Input de Cloudflare activá <strong>Low-Latency HLS</strong> (~3-5s). No actives WebRTC salvo que lo necesites — suma inestabilidad.</p>

                <p>6. En OBS <strong>Iniciar transmisión</strong>, esperá a verte estable unos segundos, y recién ahí activá <strong>"Forzar EN VIVO"</strong> abajo.</p>

                <p className="text-white/50 text-[11px] pt-1">Durante el vivo mirá el recuadro de estado de OBS (abajo a la derecha): <strong>verde</strong> = conexión sana. Si titila <strong>amarillo/rojo</strong> estás perdiendo frames → bajá el bitrate.</p>
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
          <div className={cn("border rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors", isLive ? "bg-red-500/10 border-red-500/30" : formData.is_paused ? "bg-yellow-500/10 border-yellow-500/30" : obsConnected ? "bg-red-500/5 border-red-500/20" : "bg-darker border-white/10")}>
              <div>
                <h3 className={cn("text-lg font-bold flex items-center gap-2", isLive ? "text-red-400" : formData.is_paused ? "text-yellow-500" : "text-white")}>
                  Control de Transmisión {isLive && "(¡EN VIVO!)"} {formData.is_paused && "(PAUSADO)"}
                  {obsConnected && !isLive && !formData.is_paused && <span className="text-[10px] bg-red-500/20 text-red-500 border border-red-500/50 px-2 py-0.5 rounded-full animate-pulse uppercase">OBS Detectado</span>}
                </h3>
                <p className="text-sm text-textMuted max-w-md mt-1">
                  {isLive
                    ? "La transmisión está activa. Los usuarios VIP pueden ver el evento en vivo."
                    : formData.is_paused
                    ? "La transmisión está detenida temporalmente. Los usuarios verán un mensaje de pausa."
                    : "Activa la sala para que los usuarios vean la transmisión."}
                </p>
              {formData.starts_at && !isLive && (
                <p className="text-xs text-gold mt-2 flex items-center gap-1">
                  <Calendar size={12} /> Programado: {new Date(formData.starts_at).toLocaleString("es-CO")}
                </p>
              )}
            </div>
            {isLive ? (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button onClick={() => handlePauseResume(true)}
                  className="flex-1 sm:flex-none bg-yellow-600 hover:bg-yellow-700 text-white font-bold px-4 sm:px-6 py-3 rounded-xl flex items-center justify-center gap-2 whitespace-nowrap transition-colors">
                  <StopCircle size={20} /> Detener
                </button>
                <button onClick={async () => {
                  if (!window.confirm("¿Finalizar esta sala? Pasara a estado 'ended' y no aparecerá más como próxima sala.")) return;
                  try {
                    const recordingUid = activeLive!.stream_live_input_id
                      ? (await fetchRecording(activeLive!.stream_live_input_id)).recording_uid
                      : null;
                    const updated = await updateLive(activeLive!.id, { status: "ended", recording_stream_uid: recordingUid || formData.recording_stream_uid });
                    setLives(prev => prev.map(l => l.id === updated.id ? updated : l).filter(l => l.status !== "ended"));
                    setActiveLive(null);
                    setFormData({ title: "", description: "", stream_live_input_id: PRESET_INPUT_IDS[0]?.value || "", recording_stream_uid: "", starts_at: "", background_image_url: "", allowed_plans: ["vip"], status: "scheduled", required_plan: "vip", duration_minutes: null, is_active: false });
                    const ended = await fetchEndedLives();
                    setEndedLives(ended);
                    setActiveTab("ended");
                    if (recordingUid) {
                      toast.success("Sala finalizada y grabación vinculada automáticamente");
                    } else {
                      toast.success("Sala finalizada. Usá 'Obtener grabación' en el editor si la grabación no se vinculó automáticamente.");
                    }
                  } catch (err) { console.error(err); toast.error("Error"); }
                }}
                  className="flex-1 sm:flex-none bg-red-800/50 hover:bg-red-800 text-red-400 font-bold px-4 sm:px-6 py-3 rounded-xl flex items-center justify-center gap-2 whitespace-nowrap transition-colors border border-red-800/30">
                  <StopCircle size={20} /> Finalizar
                </button>
              </div>
            ) : formData.is_paused ? (
              <button onClick={() => handlePauseResume(false)}
                className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-yellow-900/50 transition-colors">
                <PlayCircle size={20} /> Reanudar
              </button>
            ) : (
              <button onClick={() => handleToggleLive(true)}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-4 sm:px-6 py-3 rounded-xl flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-red-900/50 transition-colors">
                <PlayCircle size={20} /> {obsConnected ? "Iniciar Transmisión" : "Forzar EN VIVO"}
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === "editor" && !activeLive && (
        <div className="text-center py-20 text-textMuted bg-darker rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gold/5 rounded-full blur-3xl group-hover:bg-gold/10 transition-colors" />
          <div className="relative z-10">
            <Radio size={48} className="mx-auto mb-4 opacity-30 text-white/30" />
            <p className="text-lg font-semibold text-white/70">No hay salas activas</p>
            <p className="text-sm mt-2 max-w-sm mx-auto">
              Seleccioná una sala de la pestaña <strong className="text-white/50">Salas</strong> o creá una nueva para empezar.
            </p>
            <button onClick={handleCreateNew} disabled={isSaving}
              className="mt-6 bg-gold hover:bg-goldHover text-darker px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 transition-all shadow-lg shadow-gold/20">
              <Plus size={18} /> Crear primera sala
            </button>
          </div>
        </div>
      )}

      {activeTab === "rooms" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-white/[0.03] border border-white/10 rounded-xl">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Info size={16} className="text-gold" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm font-semibold text-white">Solo una sala puede estar activa a la vez</p>
              <ul className="text-sm text-textMuted space-y-1 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-gold/60 shrink-0">•</span>
                  <span>La sala <span className="text-green-400 font-semibold">Activa</span> es la que ven los usuarios en su dashboard y en <code className="text-gold bg-black/40 px-1.5 py-0.5 rounded text-xs">/vip-live</code>.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold/60 shrink-0">•</span>
                  <span>Hacé clic en el botón <span className="text-white font-semibold">Activa/Inactiva</span> de cada sala para cambiar cuál se publica.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold/60 shrink-0">•</span>
                  <span>Activar una sala desactiva automáticamente la anterior.</span>
                </li>
              </ul>
            </div>
          </div>
          {lives.length === 0 ? (
            <div className="text-center py-12 text-textMuted bg-darker rounded-xl border border-white/5">
              No hay salas creadas
            </div>
          ) : (
            lives.map(live => (
              <div key={live.id}
                className={cn("bg-black/50 border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 group transition-all cursor-pointer hover:bg-white/[0.03]", activeLive?.id === live.id ? "border-gold/40 bg-gold/5" : "border-white/10")}
                onClick={() => selectRoom(live)}>
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className={cn("w-3 h-3 rounded-full shrink-0 mt-1.5 sm:mt-0",
                    live.status === "live" && !live.is_paused ? "bg-red-500 animate-pulse shadow-[0_0_10px_red]" :
                    live.is_paused ? "bg-yellow-500 animate-pulse" :
                    live.starts_at ? "bg-gold/50" : "bg-gray-600")} />
                  {live.is_active && (
                    <span className="text-[8px] font-bold uppercase tracking-wider bg-green-500/15 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full shrink-0 mt-1 sm:mt-0">
                      Activa
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-white font-bold text-sm sm:text-base truncate">{live.title || "Sin título"}</h4>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1 items-center">
                      {live.starts_at && (
                        <span className="text-[10px] text-white/40 flex items-center gap-1">
                          <Calendar size={10} /> {new Date(live.starts_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {live.allowed_plans?.map(plan => (
                        <span key={plan} className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/60">{plan}</span>
                      ))}
                      {live.status === "live" && !live.is_paused && <span className="text-[10px] text-red-400 font-bold">EN VIVO</span>}
                      {live.is_paused && <span className="text-[10px] text-yellow-400 font-bold">PAUSADO</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 shrink-0">
                  {/* Toggle Activo/Inactivo */}
                  <button
                    onClick={async e => {
                      e.stopPropagation();
                      if (live.is_active) {
                        // Desactivar esta sala
                        try {
                          await deactivateAllLives();
                          setLives(prev => prev.map(l => ({ ...l, is_active: false })));
                          if (activeLive?.id === live.id) {
                            setActiveLive(null);
                            setFormData({
                              title: "", description: "", stream_live_input_id: PRESET_INPUT_IDS[0]?.value || "", starts_at: "",
                              background_image_url: "", allowed_plans: ["vip"], status: "scheduled",
                              required_plan: "vip", duration_minutes: null, is_active: false, is_paused: false,
                            });
                            setCustomInputId(false);
                          }
                          toast.success(`"${live.title || "Sala"}" desactivada`);
                        } catch { toast.error("Error al desactivar"); }
                      } else {
                        // Activar esta sala
                        try {
                          const updated = await apiSetActiveLive(live.id);
                          setLives(prev => prev.map(l => ({ ...l, is_active: l.id === updated.id })));
                          setActiveLive(updated);
                          setFormData(updated);
                          setCustomInputId(!PRESET_INPUT_IDS.some(p => p.value === updated.stream_live_input_id));
                          toast.success(`"${live.title || "Sala"}" activada`);
                        } catch { toast.error("Error al activar sala"); }
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                      live.is_active
                        ? "bg-green-500/15 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                        : "bg-white/5 text-white/40 border-white/10 hover:border-white/30 hover:text-white/70"
                    )}
                    title={live.is_active ? "Desactivar sala" : "Activar sala"}
                  >
                    <span className={cn("w-2 h-2 rounded-full", live.is_active ? "bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-white/20")} />
                    {live.is_active ? "Activa" : "Inactiva"}
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

      {activeTab === "ended" && (
        <div className="space-y-4">
          {endedLives.length === 0 ? (
            <div className="text-center py-12 text-textMuted bg-darker rounded-xl border border-white/5">
              <Video size={40} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-semibold text-white/70">No hay transmisiones finalizadas</p>
              <p className="text-sm mt-1">Las grabaciones aparecerán aquí después de finalizar un en vivo.</p>
            </div>
          ) : (
            endedLives.map(live => (
              <div key={live.id}
                className="bg-darker border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-3 h-3 rounded-full bg-gray-600 shrink-0 mt-2 sm:mt-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-white font-bold text-base sm:text-lg truncate">{live.title || "Sin título"}</h4>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1 items-center text-xs text-textMuted">
                        {live.starts_at && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> {new Date(live.starts_at).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-black/40 text-white/40">Finalizado</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {live.recording_storage === "r2" && live.recording_r2_key ? (
                      <button type="button" onClick={() => handleDownloadR2(live.id)}
                        className="flex-1 sm:flex-none bg-gold/10 hover:bg-gold/20 border border-gold/20 text-gold px-3 sm:px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap">
                        <Download size={16} /> <span className="hidden sm:inline">Descargar grabación</span><span className="sm:hidden">Descargar</span>
                      </button>
                    ) : live.recording_stream_uid ? (
                      <>
                        <button type="button" onClick={() => handleDownloadRecording(live.recording_stream_uid!)}
                          className="flex-1 sm:flex-none bg-gold/10 hover:bg-gold/20 border border-gold/20 text-gold px-3 sm:px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap">
                          <Download size={16} /> <span className="hidden sm:inline">Descargar grabación</span><span className="sm:hidden">Descargar</span>
                        </button>
                        <button type="button" onClick={() => handleArchive(live)} disabled={archivingId === live.id}
                          title="Copia la grabación a R2 y la borra de Stream para dejar de pagar storage"
                          className="flex-1 sm:flex-none bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 px-3 sm:px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap disabled:opacity-50">
                          <Archive size={16} /> <span className="hidden sm:inline">{archivingId === live.id ? "Archivando..." : "Archivar en R2"}</span><span className="sm:hidden">Archivar</span>
                        </button>
                      </>
                    ) : null}
                    <button onClick={async e => {
                      e.stopPropagation();
                      try {
                        await updateLive(live.id, { status: "scheduled" });
                        const fresh = await apiSetActiveLive(live.id);
                        setLives(prev => [...prev, fresh]);
                        setEndedLives(prev => prev.filter(l => l.id !== live.id));
                        setActiveLive(fresh);
                        setFormData(fresh);
                        setActiveTab("editor");
                        toast.success(`"${live.title || "Sala"}" movida a salas activas`);
                      } catch { toast.error("Error al reactivar"); }
                    }} className="flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-white px-3 sm:px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap">
                      <PlayCircle size={16} /> Reactivar
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(live.id); }}
                      aria-label="Eliminar"
                      className="p-2 text-red-500/70 hover:text-red-400 bg-red-500/5 rounded-lg hover:bg-red-500/20 transition-colors shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {(live.recording_storage === "r2" && live.recording_r2_key) || live.recording_stream_uid ? (
                  <div className="space-y-2">
                    <RecordingPlayer live={live} />
                    <div className="flex items-center gap-2 text-[10px] text-textMuted/60">
                      {live.recording_storage === "r2" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400/80">
                          <Archive size={11} /> Archivada en R2 (sin costo recurrente)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-400/70">
                          <Video size={11} /> En Cloudflare Stream — archivá en R2 para dejar de pagar storage
                        </span>
                      )}
                      {live.recording_duration_seconds != null && (
                        <span>· {Math.round(live.recording_duration_seconds / 60)} min</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-black/40 rounded-xl flex items-center justify-center border border-dashed border-white/10">
                    <div className="text-center">
                      <Video size={32} className="mx-auto text-white/20 mb-2" />
                      <p className="text-sm text-textMuted">Sin grabación disponible</p>
                      <p className="text-[10px] text-textMuted/50 mt-1">Agregá el UID de la grabación en el editor para verla aquí.</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminLiveManager;
