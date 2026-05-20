import { Check } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePlatformSettings, formatPrice } from "@/hooks/usePlatformSettings";

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
          Elige tu Plan de Crecimiento
        </h2>
        <p className="text-textMuted max-w-xl mx-auto text-base sm:text-lg md:text-xl text-balance">
          Impulsa tu desarrollo al nivel que necesitas. Comienza gratis o accede a la experiencia completa.
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

            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{plan.name}</h3>
            <p className="text-textMuted text-sm mb-5 sm:mb-6 sm:h-10 text-pretty">{plan.description}</p>

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

            <ul className="space-y-3 sm:space-y-4">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0 mt-0.5" />
                  <span className={plan.highlight ? "text-sm text-white/90" : "text-sm text-textMuted"}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
