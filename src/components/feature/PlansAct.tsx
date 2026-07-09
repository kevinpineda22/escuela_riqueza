import { useEffect } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePlatformSettings, formatPrice } from "@/hooks/usePlatformSettings";
import EditableField from "@/components/feature/EditableField";
import { useAdminStore, useIsCurrentUserAdmin } from "@/stores/admin.store";

/* ============================================================ */
/* Lista de features editable (agregar / quitar / editar)        */
/* ============================================================ */

// La lista se guarda como JSON en UNA key del store (mismo buffer de guardado).
const parseFeatures = (raw: string, fallback: string[]): string[] => {
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) return arr;
  } catch {
    /* JSON inválido → usamos el default */
  }
  return fallback;
};

interface PlanFeaturesProps {
  planId: string;
  defaultFeatures: string[];
  highlight: boolean;
}

const PlanFeatures = ({ planId, defaultFeatures, highlight }: PlanFeaturesProps) => {
  const key = `plan_${planId}_features`;
  const isAdmin = useIsCurrentUserAdmin();
  const isEditMode = useAdminStore((s) => s.isEditMode);
  const ensureLoaded = useAdminStore((s) => s.ensureLoaded);
  const stageChange = useAdminStore((s) => s.stageChange);
  const raw = useAdminStore((s) => s.pending[key] ?? s.values[key] ?? "");
  const confirmedRaw = useAdminStore((s) => s.values[key] ?? "");

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  const features = raw ? parseFeatures(raw, defaultFeatures) : defaultFeatures;
  // Baseline para que revertir a lo confirmado limpie el pendiente.
  const baseline = confirmedRaw || JSON.stringify(defaultFeatures);
  const commit = (next: string[]) => stageChange(key, JSON.stringify(next), baseline);

  const showEditor = isAdmin && isEditMode;

  if (!showEditor) {
    return (
      <ul className="space-y-3 sm:space-y-4">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <Check className="text-gold w-5 h-5 shrink-0 mt-0.5" />
            <span className={highlight ? "text-sm text-white/90" : "text-sm text-textMuted"}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-2">
      {features.map((feature, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Check className="text-gold w-4 h-4 shrink-0" />
          <input
            value={feature}
            onChange={(e) => {
              const next = [...features];
              next[idx] = e.target.value;
              commit(next);
            }}
            placeholder="Describe el beneficio…"
            className="flex-1 min-w-0 bg-darker border border-gold/30 focus:border-gold rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/40"
          />
          <button
            type="button"
            onClick={() => commit(features.filter((_, i) => i !== idx))}
            title="Quitar este ítem"
            aria-label="Quitar este ítem"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => commit([...features, ""])}
        className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-gold hover:text-goldHover transition-colors"
      >
        <Plus size={14} /> Agregar ítem
      </button>
    </div>
  );
};

interface PlanCard {
  id: "free" | "individual" | "vip";
  name: string;
  description: string;
  price: string;
  period: string;
  actionLabel: string;
  features: string[];
  highlight: boolean;
  badge?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export const PlansAct = () => {
  const { data: settings } = usePlatformSettings();

  const currency = settings?.currency ?? "USD";
  const individualPrice = settings?.price_individual_monthly ?? 19;
  const vipPrice = settings?.price_vip_monthly ?? 99;
  const trialDays = settings?.trial_days ?? 0;

  const plans: PlanCard[] = [
    {
      id: "free",
      name: "Gratuito",
      description: "Puerta de entrada. Sostenido por pauta de aliados.",
      price: formatPrice(0, currency),
      period: " /mes",
      actionLabel: "Empezar Gratis",
      features: [
        "Contenido introductorio seleccionado",
        "Anuncios de empresarios aliados",
        "Acceso limitado a la comunidad",
      ],
      highlight: false,
    },
    {
      id: "individual",
      name: "Individual",
      badge: "Más Elegido",
      description: "Transformación personal profunda y sin interrupciones.",
      price: formatPrice(individualPrice, currency),
      period: " /mes",
      actionLabel: trialDays > 0 ? `Probar ${trialDays} días gratis` : "Suscribirse Ahora",
      features: [
        "Todo el contenido sin anuncios",
        "Modo Podcast habilitado",
        "Notas personales y barra progreso",
        "Certificados digitales",
        "Acceso completo a la comunidad",
        ...(trialDays > 0 ? [`${trialDays} días de prueba gratis`] : []),
      ],
      highlight: true,
    },
    {
      id: "vip",
      name: "Grupal / VIP",
      description: "Para equipos empresariales y líderes de alto nivel.",
      price: formatPrice(vipPrice, currency),
      period: " /mes",
      actionLabel: "Acceso VIP",
      features: [
        "Todo lo del plan Individual",
        "Videoconferencias 1 a 1 con Iván",
        "Consultoría grupal exclusiva",
        "Descuento en eventos presenciales",
        "Soporte prioritario",
      ],
      highlight: false,
    },
  ];

  return (
    <section id="planes" className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 py-20 sm:py-24 md:py-32 border-t border-white/5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7 }}
        className="text-center mb-12 sm:mb-16 md:mb-24"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
          <EditableField textKey="plans_title" defaultValue="Elige tu Plan de Crecimiento" as="span" />
        </h2>
        <p className="text-textMuted max-w-xl mx-auto text-base sm:text-lg md:text-xl text-balance">
          <EditableField textKey="plans_subtitle" defaultValue="Impulsa tu desarrollo al nivel que necesitas. Comienza gratis o accede a la experiencia completa." as="span" />
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start"
      >
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            variants={itemVariants}
            className={`relative p-6 sm:p-8 rounded-3xl backdrop-blur-md transition-all duration-300 ${
              plan.highlight
                ? "bg-darker border-2 border-gold lg:-translate-y-4 shadow-[0_0_30px_rgba(204,164,59,0.15)] hover:shadow-[0_0_40px_rgba(204,164,59,0.25)] mt-3 lg:mt-0"
                : "bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10"
            }`}
          >
            {plan.badge && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gold text-darker text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full uppercase tracking-wide whitespace-nowrap shadow-[0_4px_14px_-2px_rgba(204,164,59,0.5)]">
                {plan.badge}
              </div>
            )}

            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
              <EditableField textKey={`plan_${plan.id}_name`} defaultValue={plan.name} as="span" />
            </h3>
            <p className="text-textMuted text-sm mb-5 sm:mb-6 sm:h-10 text-pretty">
              <EditableField textKey={`plan_${plan.id}_desc`} defaultValue={plan.description} as="span" multiline />
            </p>

            <div className="mb-6 sm:mb-8 flex items-baseline gap-1 flex-wrap">
              <span className="font-bold text-4xl sm:text-5xl text-white">
                {plan.price}
              </span>
              <span className="text-textMuted text-sm sm:text-base">{plan.period}</span>
            </div>

            <Button
              asChild
              className={`w-full py-5 sm:py-6 mb-6 sm:mb-8 rounded-xl text-sm sm:text-base ${
                plan.highlight
                  ? "bg-gold hover:bg-goldHover text-darker font-bold shadow-[0_0_15px_rgba(204,164,59,0.4)]"
                  : "bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium"
              }`}
            >
              <Link to={`/registro?plan=${plan.id}`}>
                {plan.actionLabel}
              </Link>
            </Button>

            <PlanFeatures planId={plan.id} defaultFeatures={plan.features} highlight={plan.highlight} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
