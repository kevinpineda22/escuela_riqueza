import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Megaphone,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Video as VideoIcon,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import {
  fetchSponsors,
  createSponsor,
  updateSponsor,
  deleteSponsor,
  createAdVideo,
  updateAdVideo,
  deleteAdVideo,
  type SponsorWithVideos,
  type AdVideo,
} from "@/lib/api/admin/sponsors";
import { getDirectUploadUrl, uploadFileWithProgress } from "@/lib/api/stream/content";
import LogoUploader from "@/components/feature/admin/LogoUploader";

const AdminSponsors = () => {
  const [sponsors, setSponsors] = useState<SponsorWithVideos[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Draft del sponsor seleccionado
  const [draft, setDraft] = useState<{
    name: string;
    weight: number;
    is_active: boolean;
    notes: string;
    logo_url: string | null;
  } | null>(null);

  const selected = sponsors.find((s) => s.id === selectedId) ?? null;

  const totalWeight = useMemo(
    () => sponsors.reduce((sum, s) => sum + (s.is_active ? Math.max(0, s.weight) : 0), 0),
    [sponsors]
  );

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSponsors();
      setSponsors(data);
      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
    } catch (err) {
      console.error(err);
      toast.error("No se pudieron cargar los aliados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza draft cuando cambia el seleccionado
  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({
      name: selected.name,
      weight: selected.weight,
      is_active: selected.is_active,
      notes: selected.notes ?? "",
      logo_url: selected.logo_url,
    });
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    !!selected &&
    !!draft &&
    (draft.name !== selected.name ||
      draft.weight !== selected.weight ||
      draft.is_active !== selected.is_active ||
      (draft.notes ?? "") !== (selected.notes ?? "") ||
      draft.logo_url !== selected.logo_url);

  const handleCreate = async () => {
    const name = window.prompt("Nombre del aliado");
    if (!name?.trim()) return;
    try {
      const s = await createSponsor({ name: name.trim() });
      toast.success("Aliado creado");
      await load();
      setSelectedId(s.id);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo crear el aliado");
    }
  };

  const handleSave = async () => {
    if (!selected || !draft || !dirty) return;
    setSaving(true);
    try {
      await updateSponsor(selected.id, {
        name: draft.name.trim(),
        weight: Math.max(0, Math.round(draft.weight)),
        is_active: draft.is_active,
        notes: draft.notes.trim() || null,
        logo_url: draft.logo_url,
      });
      toast.success("Cambios guardados");
      await load();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`¿Eliminar "${selected.name}" y todos sus videos? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteSponsor(selected.id);
      toast.success("Aliado eliminado");
      setSelectedId(null);
      await load();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold">
            <Megaphone size={14} /> Aliados publicitarios
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Gestor de Anuncios
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-textMuted">
            Administrá los aliados comerciales y sus videos publicitarios. Los pesos definen la
            frecuencia relativa con la que cada aliado aparece en lecciones gratuitas.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-darker transition-all hover:bg-goldHover shadow-[0_0_20px_rgba(204,164,59,0.25)]"
        >
          <Plus size={16} /> Nuevo aliado
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-textMuted">
          <Loader2 className="animate-spin text-gold" size={28} />
        </div>
      ) : sponsors.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          {/* Sidebar list */}
          <aside className="space-y-2">
            {sponsors.map((s) => {
              const pct = totalWeight > 0 && s.is_active ? (s.weight / totalWeight) * 100 : 0;
              const isSel = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-all",
                    isSel
                      ? "border-gold/40 bg-gold/10 shadow-[0_0_20px_rgba(204,164,59,0.1)]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-darker">
                      {s.logo_url ? (
                        <img src={s.logo_url} alt={s.name} className="h-full w-full object-contain p-1" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-white/30">
                          <Building2 size={18} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-white">{s.name}</span>
                        {!s.is_active && (
                          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-textMuted">
                            inactivo
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-textMuted">
                        <span>{s.videos.length} video{s.videos.length === 1 ? "" : "s"}</span>
                        <span>·</span>
                        <span className={cn("font-semibold", isSel ? "text-gold" : "text-white/60")}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Detail panel */}
          <section className="space-y-6">
            {selected && draft ? (
              <>
                <SponsorEditor
                  draft={draft}
                  setDraft={setDraft}
                  dirty={dirty}
                  saving={saving}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
                <VideosManager
                  sponsor={selected}
                  onChanged={load}
                />
              </>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center text-textMuted">
                Seleccioná un aliado para editarlo.
              </div>
            )}
          </section>
        </div>
      )}
    </motion.div>
  );
};

// ---------- Empty state ----------
const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
    <Megaphone size={40} className="mx-auto mb-4 text-white/30" />
    <h3 className="text-lg font-bold text-white">Aún no hay aliados</h3>
    <p className="mt-2 text-sm text-textMuted">
      Creá tu primer aliado publicitario para empezar a rotar anuncios en lecciones gratuitas.
    </p>
    <button
      onClick={onCreate}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-darker hover:bg-goldHover"
    >
      <Plus size={16} /> Crear primer aliado
    </button>
  </div>
);

// ---------- Sponsor Editor ----------
interface SponsorEditorProps {
  draft: { name: string; weight: number; is_active: boolean; notes: string; logo_url: string | null };
  setDraft: React.Dispatch<React.SetStateAction<{ name: string; weight: number; is_active: boolean; notes: string; logo_url: string | null } | null>>;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDelete: () => void;
}

const SponsorEditor = ({ draft, setDraft, dirty, saving, onSave, onDelete }: SponsorEditorProps) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-white">Datos del aliado</h2>
        <div className="flex gap-2">
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/20"
          >
            <Trash2 size={13} /> Eliminar
          </button>
          <button
            onClick={onSave}
            disabled={!dirty || saving}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all",
              dirty
                ? "bg-gold text-darker hover:bg-goldHover"
                : "cursor-not-allowed bg-white/5 text-white/30"
            )}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Guardar
          </button>
        </div>
      </div>

      {/* Logo */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-textMuted">
          Logo del aliado
        </label>
        <LogoUploader
          value={draft.logo_url}
          onChange={(url) => setDraft((d) => (d ? { ...d, logo_url: url } : d))}
        />
      </div>

      {/* Nombre */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-textMuted">
          Nombre
        </label>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
          placeholder="Ej: Banco Galicia"
        />
      </div>

      {/* Weight + active */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-textMuted">
            Peso (frecuencia relativa)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={draft.weight}
            onChange={(e) => setDraft((d) => (d ? { ...d, weight: Number(e.target.value) } : d))}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
          />
          <p className="mt-1.5 text-[11px] text-textMuted">
            A mayor peso, más impresiones. Los pesos se normalizan automáticamente.
          </p>
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-textMuted">
            Estado
          </label>
          <button
            type="button"
            onClick={() => setDraft((d) => (d ? { ...d, is_active: !d.is_active } : d))}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
              draft.is_active
                ? "border-gold/40 bg-gold/10 text-gold"
                : "border-white/10 bg-black/40 text-textMuted"
            )}
          >
            <span className="flex items-center gap-2">
              {draft.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
              {draft.is_active ? "Activo" : "Inactivo"}
            </span>
            <span className="text-[10px] uppercase tracking-wider opacity-60">click para alternar</span>
          </button>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-textMuted">
          Notas internas
        </label>
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
          rows={3}
          className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
          placeholder="Contacto, vigencia del contrato, observaciones…"
        />
      </div>
    </div>
  );
};

// ---------- Videos Manager ----------
const VideosManager = ({
  sponsor,
  onChanged,
}: {
  sponsor: SponsorWithVideos;
  onChanged: () => void | Promise<void>;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => {
    setError(null);
    if (!title.trim()) {
      setError("Asigná un título antes de subir el video.");
      return;
    }
    inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.type.startsWith("video/")) {
      setError("El archivo debe ser un video.");
      return;
    }
    const MAX = 500 * 1024 * 1024; // 500 MB para anuncios
    if (file.size > MAX) {
      setError(`Archivo de ${(file.size / 1024 / 1024).toFixed(0)} MB. Máx 500 MB.`);
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const { uploadURL, uid } = await getDirectUploadUrl(file.size, `ad-${sponsor.id}-${file.name}`);
      await uploadFileWithProgress(uploadURL, file, setProgress);
      await createAdVideo({
        sponsor_id: sponsor.id,
        title: title.trim(),
        stream_uid: uid,
      });
      toast.success("Video subido");
      setTitle("");
      await onChanged();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Error al subir el video";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const toggleVideo = async (v: AdVideo) => {
    try {
      await updateAdVideo(v.id, { is_active: !v.is_active });
      await onChanged();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo actualizar el video");
    }
  };

  const removeVideo = async (v: AdVideo) => {
    if (!window.confirm(`¿Eliminar el video "${v.title}"?`)) return;
    try {
      await deleteAdVideo(v.id);
      toast.success("Video eliminado");
      await onChanged();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar");
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Videos publicitarios</h2>
        <span className="text-xs text-textMuted">{sponsor.videos.length} en biblioteca</span>
      </div>

      {/* Upload form */}
      <div className="mb-5 rounded-xl border border-white/10 bg-black/30 p-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-textMuted">
          Subir nuevo video
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del anuncio (interno)"
            disabled={uploading}
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-gold/50"
          />
          <button
            onClick={handlePick}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-darker transition-all hover:bg-goldHover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? `${progress}%` : "Subir video"}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFile}
        />
        {uploading && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        )}
        <p className="mt-2 text-[11px] text-textMuted">
          MP4/WebM, máx 500 MB. Se sube directo a Cloudflare Stream.
        </p>
      </div>

      {/* Videos list */}
      {sponsor.videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-textMuted">
          Este aliado aún no tiene videos.
        </div>
      ) : (
        <ul className="space-y-2">
          {sponsor.videos.map((v) => (
            <li
              key={v.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                v.is_active
                  ? "border-white/10 bg-white/[0.04]"
                  : "border-white/5 bg-white/[0.02] opacity-60"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-darker">
                <VideoIcon size={18} className="text-gold" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{v.title}</p>
                <p className="font-mono text-[10px] text-textMuted truncate">{v.stream_uid}</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold text-gold">{v.impression_count.toLocaleString()}</p>
                <p className="text-[10px] uppercase tracking-wider text-textMuted">impresiones</p>
              </div>
              <button
                onClick={() => toggleVideo(v)}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-textMuted hover:text-gold hover:border-gold/30"
                title={v.is_active ? "Desactivar" : "Activar"}
              >
                {v.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button
                onClick={() => removeVideo(v)}
                className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminSponsors;
