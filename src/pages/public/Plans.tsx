import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ChevronDown, Sparkles, Crown, Check, X } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { PlansAct } from "@/components/feature/PlansAct";
import { cn } from "@/lib/utils";

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: FaqItem[] = [
  {
    q: "¿Puedo cambiar de plan en cualquier momento?",
    a: "Sí. Podés mejorar o bajar de plan cuando quieras desde tu panel. Los cobros se ajustan automáticamente.",
  },
  {
    q: "¿Qué incluye el plan Free?",
    a: "Contenido introductorio con publicidad de aliados, acceso limitado a la comunidad y vista previa del catálogo. Es la puerta de entrada para conocer el método de Iván.",
  },
  {
    q: "¿En qué se diferencia el plan Individual del VIP?",
    a: "Individual te da acceso completo a todo el catálogo sin anuncios, modo podcast, notas personales y certificados. VIP suma encuentros en vivo con Iván, consultoría grupal y soporte prioritario.",
  },
  {
    q: "¿Hay reembolso si no me convence?",
    a: "Tenés 14 días desde tu primera suscripción para solicitar reembolso completo sin preguntas.",
  },
  {
    q: "¿Los certificados tienen validez?",
    a: "Son certificados digitales de finalización de módulo, firmados por Escuela de la Riqueza. Ideales para sumar a tu LinkedIn o portfolio profesional.",
  },
];

const COMPARE_ROWS: { label: string; free: boolean | string; individual: boolean | string; vip: boolean | string }[] = [
  { label: "Contenido introductorio", free: true, individual: true, vip: true },
  { label: "Catálogo completo sin anuncios", free: false, individual: true, vip: true },
  { label: "Modo podcast", free: false, individual: true, vip: true },
  { label: "Notas personales", free: false, individual: true, vip: true },
  { label: "Certificados digitales", free: false, individual: true, vip: true },
  { label: "Comunidad completa", free: "Limitada", individual: true, vip: true },
  { label: "Lives en vivo con Iván", free: false, individual: false, vip: true },
  { label: "Consultoría grupal", free: false, individual: false, vip: true },
  { label: "Soporte prioritario", free: false, individual: false, vip: true },
];

const FaqRow = ({ item, index }: { item: FaqItem; index: number }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="border-b border-white/5 last:border-b-0"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-5 sm:py-6 text-left group"
      >
        <span className="text-base sm:text-lg font-semibold text-white group-hover:text-gold transition-colors">
          {item.q}
        </span>
        <ChevronDown
          size={20}
          className={cn(
            "shrink-0 text-textMuted group-hover:text-gold transition-all",
            open && "rotate-180 text-gold"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-5 sm:pb-6 text-sm sm:text-base text-textMuted leading-relaxed pr-8">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CompareCell = ({ value }: { value: boolean | string }) => {
  if (typeof value === "string") {
    return <span className="text-xs sm:text-sm text-white/70 font-medium">{value}</span>;
  }
  return value ? (
    <Check size={18} className="text-gold mx-auto" />
  ) : (
    <X size={18} className="text-white/20 mx-auto" />
  );
};

const Plans = () => {
  return (
    <div className="min-h-[100dvh] relative bg-darker selection:bg-gold/30 font-sans text-textMain">
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"
      />
      <div
        aria-hidden
        className="hidden md:block fixed top-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-gold opacity-[0.1] blur-[150px] pointer-events-none"
      />

      <Header />

      <main className="relative">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-5 sm:px-6 pt-12 sm:pt-20 pb-8 sm:pb-12 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-textMuted hover:text-gold transition-colors mb-6 sm:mb-8"
          >
            <ArrowLeft size={14} /> Volver al inicio
          </Link>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/5 border border-gold/20 mb-5 sm:mb-6">
            <Sparkles size={12} className="text-gold" />
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] font-bold text-gold/80">
              Planes y precios
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight mb-4 sm:mb-6 text-balance">
            Tu acceso al{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic pr-3 sm:pr-5 box-decoration-clone">
              rediseño cerebral
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-textMuted leading-relaxed max-w-2xl mx-auto text-balance">
            Elige el camino que se adapta a tu momento. Sin permanencia, sin letra chica.
          </p>
        </section>

        {/* Planes principales (reusa PlansAct) */}
        <div id="planes">
          <PlansAct />
        </div>

        {/* Comparativa detallada */}
        <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 sm:py-24 border-t border-white/5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="text-center mb-10 sm:mb-14"
          >
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3 sm:mb-4">
              Comparativa completa
            </h2>
            <p className="text-sm sm:text-base text-textMuted max-w-xl mx-auto">
              Todo lo que incluye cada plan, en una sola vista.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="bg-black/30 border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/10">
                    <th className="px-4 sm:px-6 py-4 text-xs sm:text-sm font-bold text-white/70 uppercase tracking-wider">
                      Feature
                    </th>
                    <th className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm font-bold text-white/70 uppercase tracking-wider min-w-[80px]">
                      Free
                    </th>
                    <th className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm font-bold text-blue-400 uppercase tracking-wider min-w-[100px]">
                      Individual
                    </th>
                    <th className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm font-bold text-gold uppercase tracking-wider min-w-[80px]">
                      <span className="inline-flex items-center gap-1">
                        <Crown size={12} /> VIP
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.label} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-white/85 font-medium">
                        {row.label}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                        <CompareCell value={row.free} />
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                        <CompareCell value={row.individual} />
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-center bg-gold/[0.03]">
                        <CompareCell value={row.vip} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-3xl mx-auto px-5 sm:px-6 py-16 sm:py-24 border-t border-white/5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="text-center mb-10 sm:mb-14"
          >
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3 sm:mb-4">
              Preguntas frecuentes
            </h2>
            <p className="text-sm sm:text-base text-textMuted max-w-xl mx-auto">
              Lo que más nos consultan antes de empezar.
            </p>
          </motion.div>

          <div>
            {FAQ.map((item, i) => (
              <FaqRow key={item.q} item={item} index={i} />
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="max-w-4xl mx-auto px-5 sm:px-6 py-16 sm:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="relative bg-gradient-to-br from-gold/10 via-darker to-darker border border-gold/20 rounded-3xl p-8 sm:p-12 overflow-hidden"
          >
            <div
              aria-hidden
              className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gold/10 blur-3xl pointer-events-none hidden sm:block"
            />
            <Sparkles className="text-gold mx-auto mb-4 sm:mb-5" size={28} />
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3 sm:mb-4 text-balance">
              Tu transformación empieza hoy
            </h3>
            <p className="text-sm sm:text-base text-textMuted max-w-md mx-auto mb-6 sm:mb-8">
              Sin permanencia. Sin promesas vacías. Solo conocimiento aplicable desde el día uno.
            </p>
            <Link
              to="/registro"
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-full bg-gold hover:bg-goldHover text-darker font-bold text-sm sm:text-base transition-all shadow-[0_8px_24px_-8px_rgba(204,164,59,0.6)] hover:shadow-[0_8px_28px_-6px_rgba(204,164,59,0.85)] hover:-translate-y-0.5"
            >
              Crear mi cuenta gratis <Sparkles size={16} />
            </Link>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Plans;
