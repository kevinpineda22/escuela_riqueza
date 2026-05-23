import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings,
  Palette,
  CreditCard,
  Bell,
  Save,
  ShieldCheck,
  Mail,
  Loader2,
  Globe,
  Phone,
  MessageCircle,
  Share2,
  Music2,
  Lock,
  AlertTriangle,
  Sparkles,
  DollarSign,
  Clock,
  Megaphone,
  Info,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import LogoUploader from "@/components/feature/admin/LogoUploader";
import {
  fetchPlatformSettings,
  updatePlatformSettings,
  type PlatformSettings,
  type PlatformSettingsPatch,
} from "@/lib/api/admin/settings";

type TabId = "brand" | "operations" | "payments" | "notifications";

// ---------- Subcomponents ----------
const Toggle = ({
  enabled,
  onChange,
  label,
  description,
  disabled = false,
  badge,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
  badge?: string;
}) => (
  <div
    className={cn(
      "flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 transition-colors",
      !disabled && "hover:bg-white/[0.06]",
      disabled && "opacity-60"
    )}
  >
    <div className="min-w-0 pr-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white">{label}</span>
        {badge && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300 ring-1 ring-amber-500/30">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-textMuted">{description}</div>
    </div>
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={cn(
        "relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gold/40",
        enabled ? "bg-gold" : "bg-white/15",
        disabled && "cursor-not-allowed"
      )}
      aria-pressed={enabled}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition",
          enabled ? "translate-x-5 bg-darker" : "translate-x-0 bg-white/80"
        )}
      />
    </button>
  </div>
);

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "url" | "email" | "tel" | "number";
  icon?: React.ElementType;
  hint?: string;
  prefix?: string;
  min?: number;
  max?: number;
  step?: number;
}

const Field = ({ label, value, onChange, placeholder, type = "text", icon: Icon, hint, prefix, min, max, step }: FieldProps) => (
  <div>
    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-textMuted">{label}</label>
    <div
      className={cn(
        "group flex items-center overflow-hidden rounded-xl border border-white/10 bg-black/40 transition-colors focus-within:border-gold/50 focus-within:ring-2 focus-within:ring-gold/15",
        Icon || prefix ? "pl-3" : ""
      )}
    >
      {Icon && <Icon size={15} className="shrink-0 text-textMuted group-focus-within:text-gold" />}
      {prefix && <span className="shrink-0 pr-2 text-sm text-textMuted">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder:text-textMuted/60 focus:outline-none"
      />
    </div>
    {hint && <p className="mt-1.5 text-[11px] text-textMuted/70">{hint}</p>}
  </div>
);

const Section = ({ title, description, children, icon: Icon }: { title: string; description?: string; children: React.ReactNode; icon?: React.ElementType }) => (
  <div>
    <div className="mb-4 flex items-start gap-3">
      {Icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold ring-1 ring-gold/30">
          <Icon size={16} />
        </div>
      )}
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-textMuted">{description}</p>}
      </div>
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

const Banner = ({
  variant,
  title,
  children,
  icon: Icon,
}: {
  variant: "info" | "warn" | "preview";
  title: string;
  children: React.ReactNode;
  icon: React.ElementType;
}) => {
  const styles = {
    info: "bg-blue-500/5 border-blue-500/20 text-blue-300",
    warn: "bg-amber-500/5 border-amber-500/20 text-amber-300",
    preview: "bg-purple-500/5 border-purple-500/20 text-purple-300",
  }[variant];
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-4", styles)}>
      <Icon className="mt-0.5 shrink-0" size={18} />
      <div className="min-w-0">
        <h4 className="text-sm font-bold">{title}</h4>
        <div className="mt-1 text-xs text-textMuted">{children}</div>
      </div>
    </div>
  );
};

// ---------- Main ----------
const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState<TabId>("brand");
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchPlatformSettings();
        if (cancelled) return;
        setSettings(s);
        setDraft(s);
      } catch (err) {
        console.error(err);
        toast.error("No se pudo cargar la configuración");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => {
    if (!settings || !draft) return false;
    const keys = Object.keys(draft) as (keyof PlatformSettings)[];
    return keys.some((k) => draft[k] !== settings[k]);
  }, [draft, settings]);

  const update = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!draft || !settings || !dirty) return;
    setSaving(true);
    const patch: PlatformSettingsPatch = {};
    (Object.keys(draft) as (keyof PlatformSettings)[]).forEach((k) => {
      if (k === "id" || k === "updated_at" || k === "updated_by") return;
      if (draft[k] !== settings[k]) {
        // @ts-expect-error dynamic
        patch[k] = draft[k];
      }
    });
    try {
      const updated = await updatePlatformSettings(patch);
      setSettings(updated);
      setDraft(updated);
      await queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      toast.success("Configuración guardada");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) setDraft(settings);
  };

  const tabs = [
    { id: "brand", label: "Identidad", icon: Palette, hint: "Marca y contacto" },
    { id: "operations", label: "Operativa", icon: ShieldCheck, hint: "Acceso y mantenimiento" },
    { id: "payments", label: "Pagos & Planes", icon: CreditCard, hint: "Precios y monedas" },
    { id: "notifications", label: "Notificaciones", icon: Bell, hint: "Correos automáticos" },
  ] as const;

  if (loading || !draft) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  const fmtPrice = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: draft.currency }).format(n);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex min-h-0 max-w-7xl flex-1 flex-col"
    >
      {/* Header */}
      <div className="mb-6 flex shrink-0 flex-col items-start justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white sm:gap-3 sm:text-3xl">
            <Settings className="text-gold" size={28} /> Ajustes del Sistema
          </h1>
          <p className="mt-1 text-sm text-textMuted sm:text-base">
            Configuración global de la plataforma. Los cambios afectan a toda la escuela.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
          <AnimatePresence>
            {dirty && !saving && (
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                onClick={handleReset}
                className="rounded-xl px-3 py-2.5 text-sm text-textMuted transition-colors hover:bg-white/5 hover:text-white"
              >
                Descartar
              </motion.button>
            )}
          </AnimatePresence>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all sm:flex-none sm:px-6 sm:text-base",
              dirty
                ? "bg-gold text-darker shadow-[0_4px_14px_rgba(204,164,59,0.4)] hover:bg-goldHover"
                : "cursor-not-allowed bg-white/5 text-textMuted"
            )}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? "Guardando…" : dirty ? "Guardar cambios" : "Sin cambios"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-8">
        {/* Sidebar */}
        <aside className="custom-scrollbar -mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:w-64 md:flex-col md:overflow-visible md:px-0 md:pb-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-all sm:px-4 sm:py-3 sm:text-sm md:w-full",
                  isActive
                    ? "border border-gold/30 bg-gradient-to-r from-gold/15 to-transparent text-white shadow-[0_4px_18px_-8px_rgba(204,164,59,0.4)]"
                    : "border border-transparent text-textMuted hover:bg-white/5 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <Icon size={16} className={isActive ? "text-gold" : "opacity-70"} />
                  <span>{tab.label}</span>
                </div>
                <div className="mt-0.5 hidden pl-7 text-[11px] text-textMuted/70 md:block">{tab.hint}</div>
              </button>
            );
          })}
        </aside>

        {/* Content */}
        <div className="custom-scrollbar relative flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-5 sm:p-6">
          <AnimatePresence mode="wait">
            {/* IDENTIDAD */}
            {activeTab === "brand" && (
              <motion.div
                key="brand"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <Section title="Identidad de la plataforma" description="Cómo se llama y se identifica la escuela." icon={Sparkles}>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field
                      label="Nombre de la plataforma"
                      value={draft.platform_name}
                      onChange={(v) => update("platform_name", v)}
                      icon={Globe}
                      placeholder="Escuela de la Riqueza"
                    />
                    <Field
                      label="Tagline del footer"
                      value={draft.footer_tagline ?? ""}
                      onChange={(v) => update("footer_tagline", v || null)}
                      placeholder="Educación financiera con propósito."
                    />
                  </div>
                </Section>

                <hr className="border-white/10" />

                <Section title="Contacto" description="Datos visibles en footer y correos transaccionales." icon={Mail}>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field
                      label="Correo de soporte"
                      value={draft.support_email}
                      onChange={(v) => update("support_email", v)}
                      type="email"
                      icon={Mail}
                      placeholder="soporte@escuelariqueza.com"
                    />
                    <Field
                      label="Teléfono de contacto"
                      value={draft.contact_phone ?? ""}
                      onChange={(v) => update("contact_phone", v || null)}
                      type="tel"
                      icon={Phone}
                      placeholder="+57 312 297 5931"
                    />
                    <Field
                      label="WhatsApp (sólo dígitos)"
                      value={draft.whatsapp_number ?? ""}
                      onChange={(v) => update("whatsapp_number", v.replace(/\D/g, "") || null)}
                      icon={MessageCircle}
                      placeholder="573122975931"
                      hint="Sin '+' ni espacios. Se usa para wa.me/…"
                    />
                  </div>
                </Section>

                <hr className="border-white/10" />

                <Section title="Redes sociales" description="Enlaces que aparecen en el footer público." icon={Share2}>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field
                      label="Instagram"
                      value={draft.instagram_url ?? ""}
                      onChange={(v) => update("instagram_url", v || null)}
                      type="url"
                      icon={Share2}
                      placeholder="https://instagram.com/…"
                    />
                    <Field
                      label="Facebook"
                      value={draft.facebook_url ?? ""}
                      onChange={(v) => update("facebook_url", v || null)}
                      type="url"
                      icon={Share2}
                      placeholder="https://facebook.com/…"
                    />
                    <Field
                      label="YouTube"
                      value={draft.youtube_url ?? ""}
                      onChange={(v) => update("youtube_url", v || null)}
                      type="url"
                      icon={Share2}
                      placeholder="https://youtube.com/@…"
                    />
                    <Field
                      label="TikTok"
                      value={draft.tiktok_url ?? ""}
                      onChange={(v) => update("tiktok_url", v || null)}
                      type="url"
                      icon={Music2}
                      placeholder="https://tiktok.com/@…"
                    />
                  </div>
                </Section>

                <hr className="border-white/10" />

                <Section title="Logotipo" description="Subí el logo de tu plataforma. Se sirve por CDN de Cloudflare Images." icon={Palette}>
                  <LogoUploader
                    value={draft.logo_url}
                    onChange={(url) => update("logo_url", url)}
                    fallback="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
                  />
                </Section>
              </motion.div>
            )}

            {/* OPERATIVA */}
            {activeTab === "operations" && (
              <motion.div
                key="operations"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <Section title="Acceso a la plataforma" description="Controla quién puede registrarse y entrar." icon={Lock}>
                  <Toggle
                    label="Permitir registros nuevos"
                    description="Si se desactiva, nadie podrá crear cuenta desde la página de registro."
                    enabled={draft.allow_signups}
                    onChange={(v) => update("allow_signups", v)}
                  />
                  <Toggle
                    label="Modo mantenimiento"
                    description="Muestra una pantalla de mantenimiento a usuarios no-admin."
                    enabled={draft.maintenance_mode}
                    onChange={(v) => update("maintenance_mode", v)}
                    badge="Sensible"
                  />
                  {draft.maintenance_mode && (
                    <Field
                      label="Mensaje de mantenimiento"
                      value={draft.maintenance_message ?? ""}
                      onChange={(v) => update("maintenance_message", v || null)}
                      placeholder="Estamos realizando mejoras…"
                    />
                  )}
                </Section>

                <hr className="border-white/10" />

                <Section title="Plan por defecto al registrarse" description="Plan asignado a usuarios nuevos cuando se crea su cuenta." icon={Sparkles}>
                  <div className="grid grid-cols-3 gap-3">
                    {(["free", "individual", "vip"] as const).map((plan) => {
                      const active = draft.default_signup_plan === plan;
                      const labels = { free: "Gratis", individual: "Individual", vip: "VIP" };
                      return (
                        <button
                          key={plan}
                          type="button"
                          onClick={() => update("default_signup_plan", plan)}
                          className={cn(
                            "rounded-xl border p-4 text-left transition-all",
                            active
                              ? "border-gold bg-gradient-to-br from-gold/15 to-transparent text-white shadow-[0_0_20px_-8px_rgba(204,164,59,0.5)]"
                              : "border-white/10 bg-white/[0.03] text-textMuted hover:border-white/25 hover:text-white"
                          )}
                        >
                          <div className="text-xs font-bold uppercase tracking-wide">{labels[plan]}</div>
                          <div className="mt-1 text-[11px] opacity-70">
                            {plan === "free" && "Acceso limitado, con publicidad."}
                            {plan === "individual" && "Catálogo completo sin lives 1:1."}
                            {plan === "vip" && "Todo + lives con Iván."}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                <hr className="border-white/10" />

                <Section title="Plan FREE (Anuncios)" description="Configuración de la publicidad para usuarios gratuitos." icon={Megaphone}>
                  <div className="space-y-6">
                    {/* Modo de aparición */}
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-textMuted">Modo de aparición</label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {(["preroll", "midroll", "both", "none"] as const).map((type) => {
                          const labels = {
                            preroll: "Solo al inicio",
                            midroll: "Solo intervalos",
                            both: "Inicio + Intervalos",
                            none: "Desactivados",
                          };
                          const active = draft.free_ad_type === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => update("free_ad_type", type)}
                              className={cn(
                                "rounded-xl border px-3 py-2.5 text-xs font-bold transition-all",
                                active
                                  ? type === "none"
                                    ? "border-red-500/50 bg-red-500/10 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                                    : "border-gold bg-gradient-to-r from-gold/15 to-transparent text-white shadow-[0_0_12px_rgba(204,164,59,0.3)]"
                                  : "border-white/10 bg-white/[0.03] text-textMuted hover:border-white/25 hover:text-white"
                              )}
                            >
                              {labels[type]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      {/* Frecuencia (Solo si hay midroll) */}
                      {(draft.free_ad_type === "midroll" || draft.free_ad_type === "both") && (
                        <Field
                          label="Frecuencia (segundos)"
                          value={String(draft.free_ad_frequency_seconds)}
                          onChange={(v) => update("free_ad_frequency_seconds", Math.max(30, Number(v) || 0))}
                          type="number"
                          min={30}
                          icon={Clock}
                          hint="Mínimo 30. Tiempo entre pausas publicitarias."
                        />
                      )}

                      {/* Cantidad por bloque */}
                      {draft.free_ad_type !== "none" && (
                        <Field
                          label="Anuncios por pausa"
                          value={String(draft.free_ads_per_block)}
                          onChange={(v) => update("free_ads_per_block", Math.max(1, Number(v) || 1))}
                          type="number"
                          min={1}
                          max={5}
                          icon={Layers}
                          hint="Ej: 2 reproducirá dos anuncios seguidos por bloque."
                        />
                      )}
                    </div>
                  </div>
                </Section>
              </motion.div>
            )}

            {/* PAGOS */}
            {activeTab === "payments" && (
              <motion.div
                key="payments"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <Banner variant="preview" title="Vista previa — pagos en simulación" icon={Info}>
                  Stripe aún no está conectado. Estos valores controlan los precios mostrados en el sitio público y se usarán como referencia cuando se integre el procesador.
                </Banner>

                <Section title="Configuración de cobros" description="Moneda, periodo de prueba y precios mensuales." icon={DollarSign}>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-textMuted">Moneda</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(["USD", "COP", "MXN", "EUR"] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => update("currency", c)}
                            className={cn(
                              "rounded-xl border px-2 py-2.5 text-xs font-bold transition-all",
                              draft.currency === c
                                ? "border-gold bg-gold/15 text-gold"
                                : "border-white/10 bg-white/[0.03] text-textMuted hover:border-white/25 hover:text-white"
                            )}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Field
                      label="Días de prueba"
                      value={String(draft.trial_days)}
                      onChange={(v) => update("trial_days", Math.max(0, Number(v) || 0))}
                      type="number"
                      min={0}
                      icon={Clock}
                      hint="0 = sin trial. Se aplicará al activar Stripe."
                    />
                  </div>
                </Section>

                <hr className="border-white/10" />

                <Section title="Planes" description="Precio mensual por plan." icon={CreditCard}>
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-textMuted">Plan Individual</div>
                          <div className="mt-0.5 text-lg font-bold text-white">{fmtPrice(draft.price_individual_monthly)}<span className="text-sm font-normal text-textMuted">/mes</span></div>
                        </div>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">Estándar</span>
                      </div>
                      <Field
                        label="Precio mensual"
                        value={String(draft.price_individual_monthly)}
                        onChange={(v) => update("price_individual_monthly", Math.max(0, Number(v) || 0))}
                        type="number"
                        min={0}
                        step={0.01}
                        prefix={draft.currency}
                      />
                    </div>

                    <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/[0.08] to-transparent p-5 shadow-[0_0_24px_-12px_rgba(204,164,59,0.4)]">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-gold">Plan VIP</span>
                            <Sparkles size={12} className="text-gold" />
                          </div>
                          <div className="mt-0.5 text-lg font-bold text-white">{fmtPrice(draft.price_vip_monthly)}<span className="text-sm font-normal text-textMuted">/mes</span></div>
                        </div>
                        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">Premium</span>
                      </div>
                      <Field
                        label="Precio mensual"
                        value={String(draft.price_vip_monthly)}
                        onChange={(v) => update("price_vip_monthly", Math.max(0, Number(v) || 0))}
                        type="number"
                        min={0}
                        step={0.01}
                        prefix={draft.currency}
                      />
                    </div>
                  </div>
                </Section>

                <hr className="border-white/10" />

                <Section title="Procesador de pagos" description="Stripe (pendiente de integración)." icon={CreditCard}>
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#635BFF]/10 text-[#635BFF]">
                        <CreditCard size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-white">Stripe</div>
                        <p className="mt-0.5 text-xs text-textMuted">Las llaves API se guardarán como variables de entorno seguras (server-side). Sólo se mostrarán los últimos 4 caracteres una vez configuradas.</p>
                      </div>
                      <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-bold uppercase text-amber-300 ring-1 ring-amber-500/30">No conectado</span>
                    </div>
                  </div>
                </Section>
              </motion.div>
            )}

            {/* NOTIFICACIONES */}
            {activeTab === "notifications" && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <Banner variant="warn" title="Servicio de correo no configurado" icon={AlertTriangle}>
                  Para enviar correos transaccionales fuera del límite de Supabase (~3/hora) necesitas conectar un proveedor SMTP (Resend, SendGrid, Postmark). Mientras tanto, los toggles se guardan pero no envían correos masivos.
                </Banner>

                <Section title="Correos automáticos" description="Activa qué correos envía la plataforma cuando se conecte el proveedor SMTP." icon={Mail}>
                  <Toggle
                    label="Correo de bienvenida"
                    description="Se envía cuando un usuario confirma su cuenta. (Confirmación de email ya gestionada por Supabase Auth)."
                    enabled={draft.notif_welcome_email}
                    onChange={(v) => update("notif_welcome_email", v)}
                  />
                  <Toggle
                    label="Nuevo módulo disponible"
                    description="Notifica a usuarios con plan activo cuando se publica un módulo nuevo."
                    enabled={draft.notif_new_module}
                    onChange={(v) => update("notif_new_module", v)}
                    badge="Pendiente SMTP"
                  />
                  <Toggle
                    label="Recordatorio de live VIP (1h antes)"
                    description="Envía un aviso a usuarios VIP antes de que inicie una sala en vivo."
                    enabled={draft.notif_live_reminder}
                    onChange={(v) => update("notif_live_reminder", v)}
                    badge="Pendiente SMTP"
                  />
                  <Toggle
                    label="Boletín promocional"
                    description="Permite el envío de correos masivos. Requiere consentimiento explícito del usuario."
                    enabled={draft.notif_marketing}
                    onChange={(v) => update("notif_marketing", v)}
                    badge="Pendiente SMTP"
                  />
                </Section>

                <hr className="border-white/10" />

                <Section title="Plantilla de confirmación de cuenta" description="Diseño actual del correo que envía Supabase al registrarse." icon={Sparkles}>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-textMuted">
                    <p>
                      La plantilla branded está en{" "}
                      <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white">docs/email-templates/confirm-signup.html</code>.
                    </p>
                    <p className="mt-2">
                      Para aplicarla: <strong className="text-white">Supabase Dashboard → Authentication → Email Templates → "Confirm signup"</strong> y pegar el contenido HTML.
                    </p>
                    <p className="mt-2">
                      Asunto sugerido: <em className="text-white/80">"Confirma tu cuenta en {draft.platform_name}"</em>.
                    </p>
                  </div>
                </Section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminSettings;
