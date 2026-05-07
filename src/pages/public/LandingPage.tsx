import { Check } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { HeroCinematic } from "@/components/feature/HeroCinematic";
import { AwakeningAct } from "@/components/feature/AwakeningAct";
import { IntelligencesAct } from "@/components/feature/IntelligencesAct";
import { PathAct } from "@/components/feature/PathAct";

const LandingPage = () => {
  return (
    <div className="min-h-screen relative bg-darker selection:bg-gold/30 font-sans text-textMain">
      {/* Background grid sutil — fixed para sensación de profundidad cinematic */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"
      />
      {/* Glow gold del hero */}
      <div
        aria-hidden
        className="fixed top-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-gold opacity-[0.12] blur-[150px] pointer-events-none"
      />

      <Header />

      <main>
        <HeroCinematic />

        <AwakeningAct />

        <IntelligencesAct />

        <PathAct />

        {/* Planes (placeholder pre-Acto 6) */}
        <section id="planes" className="relative z-10 max-w-7xl mx-auto px-6 py-24 border-t border-white/5">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Elige tu Plan de Crecimiento</h2>
            <p className="text-textMuted max-w-xl mx-auto text-lg">
              Impulsa tu desarrollo al nivel que necesitas. Comienza gratis o accede a la experiencia completa.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            {/* Gratuito */}
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-md">
              <h3 className="text-2xl font-bold text-white mb-2">Gratuito</h3>
              <p className="text-textMuted text-sm mb-6 h-10">Puerta de entrada. Sostenido por pauta de aliados.</p>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-textMuted"> /mes</span>
              </div>
              <button
                type="button"
                className="w-full py-3 mb-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all"
              >
                Empezar Gratis
              </button>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-textMuted">Contenido introductorio seleccionado</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-textMuted">Anuncios de empresarios aliados</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-textMuted">Acceso limitado a la comunidad</span>
                </li>
              </ul>
            </div>

            {/* Individual */}
            <div className="p-8 rounded-3xl bg-darker border-2 border-gold relative transform lg:-translate-y-4 shadow-[0_0_30px_rgba(204,164,59,0.15)]">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gold text-darker text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                Más Elegido
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Individual</h3>
              <p className="text-textMuted text-sm mb-6 h-10">Transformación personal profunda y sin interrupciones.</p>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-xl text-textMuted">Mensual o Anual</span>
              </div>
              <button
                type="button"
                className="w-full py-3 mb-8 rounded-xl bg-gold hover:bg-goldHover text-darker font-bold transition-all shadow-[0_0_15px_rgba(204,164,59,0.4)]"
              >
                Suscribirse Ahora
              </button>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-white">Todo el contenido sin anuncios</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-white">Modo Podcast habilitado</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-white">Notas personales y barra progreso</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-white">Certificados digitales</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-white">Acceso completo a la comunidad</span>
                </li>
              </ul>
            </div>

            {/* Grupal / VIP */}
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-md">
              <h3 className="text-2xl font-bold text-white mb-2">Grupal / VIP</h3>
              <p className="text-textMuted text-sm mb-6 h-10">Para equipos empresariales y líderes de alto nivel.</p>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-xl text-textMuted">Empresarial a medida</span>
              </div>
              <button
                type="button"
                className="w-full py-3 mb-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all"
              >
                Contactar Ventas
              </button>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-textMuted">Todo lo del plan Individual</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-textMuted">Videoconferencias 1 a 1 con Iván</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-textMuted">Consultoría grupal exclusiva</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-textMuted">Descuento en eventos presenciales</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-gold w-5 h-5 shrink-0" />
                  <span className="text-sm text-textMuted">Soporte prioritario</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default LandingPage;
