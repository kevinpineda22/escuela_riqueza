import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import EditableField from "@/components/feature/EditableField";
import { useAdminStore, useIsCurrentUserAdmin } from "@/stores/admin.store";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { usePreferencesStore } from "@/stores/preferences.store";

/* ============================================================ */
/* Count-up de los stats                                         */
/* ============================================================ */

interface ParsedStat {
  prefix: string;
  suffix: string;
  target: number;
  grouped: boolean; // el original traía separador de miles
}

// Separa "15.000+" → { prefix:"", target:15000, suffix:"+", grouped:true }.
const parseStat = (raw: string): ParsedStat | null => {
  const match = raw.match(/^(\D*)([\d.,]+)(.*)$/s);
  if (!match) return null;
  const [, prefix, core, suffix] = match;
  const digits = core.replace(/\D/g, "");
  if (!digits) return null;
  return { prefix, suffix, target: parseInt(digits, 10), grouped: /[.,]/.test(core) };
};

const formatNum = (n: number, grouped: boolean): string =>
  grouped ? n.toLocaleString("es-CO") : String(n);

/**
 * Cuenta desde 0 hasta el valor al entrar en viewport. Preserva prefijo, sufijo
 * y separador de miles. Si el valor no es numérico o el usuario pidió menos
 * movimiento, muestra el texto final directo.
 */
const CountUp = ({ value }: { value: string }) => {
  const parsed = parseStat(value);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const prefersReduced = usePrefersReducedMotion();
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);
  const reduce = prefersReduced || !animationsEnabled;

  const [display, setDisplay] = useState(() =>
    parsed && !reduce
      ? `${parsed.prefix}${formatNum(0, parsed.grouped)}${parsed.suffix}`
      : value,
  );

  useEffect(() => {
    const p = parseStat(value);
    if (!p || reduce) {
      setDisplay(value);
      return;
    }
    if (!inView) return;

    let raf = 0;
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const current = Math.round(eased * p.target);
      setDisplay(`${p.prefix}${formatNum(current, p.grouped)}${p.suffix}`);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, value]);

  return <span ref={ref}>{display}</span>;
};

/**
 * En modo edición admin → EditableField (Iván cambia la cifra). Para el resto →
 * count-up animado. Así la cifra sigue siendo editable Y deslumbra al entrar.
 */
const AnimatedStat = ({ textKey, defaultValue }: { textKey: string; defaultValue: string }) => {
  const isAdmin = useIsCurrentUserAdmin();
  const isEditMode = useAdminStore((s) => s.isEditMode);
  const ensureLoaded = useAdminStore((s) => s.ensureLoaded);
  const value = useAdminStore((s) => s.pending[textKey] ?? s.values[textKey] ?? defaultValue);

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  if (isAdmin && isEditMode) {
    return <EditableField textKey={textKey} defaultValue={defaultValue} as="span" />;
  }
  return <CountUp value={value} />;
};

/* ============================================================ */
/* Frase viva (revelado palabra por palabra)                     */
/* ============================================================ */

/**
 * Revela la frase palabra por palabra al entrar en viewport (materializa con
 * blur → nítido). Sensación de que la web "habla", no de texto plano. Igual que
 * los stats: en modo edición admin → EditableField; para el resto → animada.
 * Respeta reduce-motion (muestra la frase entera de una).
 */
const AnimatedPhrase = ({
  textKey,
  defaultValue,
  className,
}: {
  textKey: string;
  defaultValue: string;
  className?: string;
}) => {
  const isAdmin = useIsCurrentUserAdmin();
  const isEditMode = useAdminStore((s) => s.isEditMode);
  const ensureLoaded = useAdminStore((s) => s.ensureLoaded);
  const value = useAdminStore((s) => s.pending[textKey] ?? s.values[textKey] ?? defaultValue);
  const prefersReduced = usePrefersReducedMotion();
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);
  const reduce = prefersReduced || !animationsEnabled;

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  if (isAdmin && isEditMode) {
    return <EditableField textKey={textKey} defaultValue={defaultValue} as="span" className={className} />;
  }

  if (reduce) return <span className={className}>{value}</span>;

  const words = value.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={`${i}-${word}`}
          className="inline-block mr-[0.25em] will-change-[transform,opacity,filter]"
          initial={{ opacity: 0, y: "0.4em", filter: "blur(10px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: i * 0.09, ease: [0.2, 0.65, 0.3, 0.9] }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
};

/* ============================================================ */
/* Ambiente de fondo                                             */
/* ============================================================ */

/**
 * Ambiente sutil detrás de los tres frames: mantiene la energía viva tras el
 * hero, sin robarle foco al texto. Blobs dorados de baja opacidad que respiran.
 */
const AwakeningAmbient = () => (
  <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
    <motion.div
      className="absolute top-[6%] left-[8%] w-[46vw] max-w-[520px] aspect-square rounded-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.10),transparent_65%)] blur-[100px]"
      animate={{ x: [0, 40, 0], y: [0, -30, 0], opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] max-w-[440px] aspect-square rounded-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.06),transparent_70%)] blur-[120px]"
      animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.55, 0.3] }}
      transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute bottom-[10%] right-[6%] w-[50vw] max-w-[560px] aspect-square rounded-full bg-[radial-gradient(circle_at_center,rgba(160,110,30,0.10),transparent_65%)] blur-[110px]"
      animate={{ x: [0, -40, 0], y: [0, 30, 0], opacity: [0.35, 0.6, 0.35] }}
      transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 3 }}
    />
  </div>
);

/* ============================================================ */
/* Stat card                                                     */
/* ============================================================ */

interface StatCardProps {
  valueKey: string;
  labelKey: string;
  defaultValue: string;
  defaultLabel: string;
  delay: number;
}

const StatCard = ({ valueKey, labelKey, defaultValue, defaultLabel, delay }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.6, delay, ease: "easeOut" }}
    className="flex flex-col items-center text-center"
  >
    <div className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-gold drop-shadow-[0_0_15px_rgba(204,164,59,0.35)]">
      <AnimatedStat textKey={valueKey} defaultValue={defaultValue} />
    </div>
    <div className="text-textMuted uppercase tracking-widest text-xs md:text-sm font-semibold mt-3 max-w-[200px]">
      <EditableField textKey={labelKey} defaultValue={defaultLabel} as="span" />
    </div>
  </motion.div>
);

/**
 * Acto 2 — El Despertar.
 *
 * Tres "frames" como sub-secciones min-h-screen. Cada uno se revela al entrar al
 * viewport. Sin sticky pinning — evita huecos oscuros entre actos. Ambiente
 * dorado sutil de fondo para que no caiga la energía tras el hero.
 */
export const AwakeningAct = () => {
  return (
    <div aria-label="El despertar" className="relative overflow-hidden">
      <AwakeningAmbient />

      {/* Frame 1 — La pregunta (se revela palabra por palabra) */}
      <section className="relative z-10 min-h-[58svh] md:min-h-[68svh] flex items-center justify-center px-5 sm:px-6 py-16 sm:py-20 overflow-hidden">
        <h2 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold text-white/55 leading-[1.15] tracking-tight max-w-5xl text-center text-balance">
          <AnimatedPhrase
            textKey="awakening_question"
            defaultValue="¿Cuántas oportunidades dejaste pasar?"
          />
        </h2>
      </section>

      {/* Frame 2 — La respuesta */}
      <section className="relative z-10 min-h-[58svh] md:min-h-[68svh] flex items-center justify-center px-5 sm:px-6 py-16 sm:py-20 overflow-hidden">
        <motion.h2
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-extrabold leading-[1.2] tracking-tight max-w-5xl text-center text-balance pb-3"
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
            <EditableField textKey="awakening_answer" defaultValue="Es momento de" as="span" className="inline" />
          </span>{" "}
          <motion.span
            className="text-gold italic pr-3 sm:pr-5 box-decoration-clone"
            animate={{
              textShadow: [
                "0 0 20px rgba(204,164,59,0.35)",
                "0 0 48px rgba(204,164,59,0.8)",
                "0 0 20px rgba(204,164,59,0.35)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <EditableField textKey="awakening_accent" defaultValue="cambiar." as="span" className="inline" />
          </motion.span>
        </motion.h2>
      </section>

      {/* Frame 3 — Los números */}
      <section className="relative z-10 min-h-[62svh] md:min-h-[70svh] flex items-center justify-center px-5 sm:px-6 py-16 sm:py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-14 md:gap-12 lg:gap-24 w-full max-w-5xl">
          <StatCard valueKey="stat_1_value" labelKey="stat_1_label" defaultValue="15.000+" defaultLabel="Alumnos transformados" delay={0} />
          <StatCard valueKey="stat_2_value" labelKey="stat_2_label" defaultValue="120 h" defaultLabel="Horas de contenido" delay={0.15} />
          <StatCard valueKey="stat_3_value" labelKey="stat_3_label" defaultValue="6" defaultLabel="Inteligencias críticas" delay={0.3} />
        </div>
      </section>
    </div>
  );
};
