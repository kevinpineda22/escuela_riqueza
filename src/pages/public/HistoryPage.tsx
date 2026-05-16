import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, User, Lightbulb, Target } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Stream } from "@cloudflare/stream-react";

const HistoryPage = () => {
  return (
    <div className="min-h-[100dvh] relative bg-darker selection:bg-gold/30 font-sans text-textMain">
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"
      />
      <div
        aria-hidden
        className="hidden md:block fixed top-0 left-0 -z-10 h-[600px] w-[600px] rounded-full bg-gold opacity-[0.07] blur-[150px] pointer-events-none"
      />
      <div
        aria-hidden
        className="hidden md:block fixed bottom-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-gold opacity-[0.05] blur-[120px] pointer-events-none"
      />

      <Header />

      <main className="relative pt-24 sm:pt-32 pb-16 sm:pb-24">
        <section className="max-w-4xl mx-auto px-5 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-textMuted hover:text-gold transition-colors mb-8"
          >
            <ArrowLeft size={14} /> Volver al inicio
          </Link>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/5 border border-gold/20 mb-6">
            <Sparkles size={12} className="text-gold" />
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] font-bold text-gold/80">
              Nuestra historia
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-6 leading-tight">
            ¿Qué es la Escuela de La Riqueza y por qué llegó para{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic">
              cambiar tu vida?
            </span>
          </h1>

          <div className="prose prose-invert max-w-none prose-p:text-textMuted prose-p:leading-relaxed prose-p:text-base sm:prose-p:text-lg">
            <p className="mb-6 text-lg sm:text-xl text-white/80 font-medium">
              A partir de un arduo estudio e investigación sobre la vida de los más grandes y reconocidos empresarios <strong>¡Nació La Escuela de La Riqueza!</strong> Un poderoso programa que llegó para darle el verdadero significado a la palabra ‘’riqueza’’ que durante años solo se ha asociado con el dinero; ignorando por completo que la razón de ser de una empresa no solo es hacer más plata, sino aportar en la construcción de una sociedad digna para el ser humano.
            </p>

            <div className="p-6 sm:p-8 bg-gold/5 border-l-4 border-gold rounded-r-2xl my-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-2xl -mr-10 -mt-10" />
              <p className="text-white text-base sm:text-lg italic relative z-10 m-0 leading-relaxed font-serif">
                "¡Nunca volverás a ser el mismo después de este programa! Porque vas a transformar tu mentalidad y te convertirás en el nuevo empresario que el mundo necesita. Descubrirás cómo utilizar tu inteligencia en su máxima expresión y lograrás tener un desempeño óptimo que te ayudará a mejorar en los dos entornos más importantes… <strong>¡Tu vida y tu trabajo!</strong>"
              </p>
            </div>

            <div className="my-12 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(204,164,59,0.15)] border border-white/10 relative bg-black aspect-video group">
              <Stream
                src="6c7dbd66798d0c85e0e1fb0689916a8c"
                controls
                responsive={false}
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 mt-16">
              <div className="md:col-span-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 flex items-center gap-3">
                  <User className="text-gold" size={28} />
                  ¿Quién fundó La Escuela de la Riqueza?
                </h2>
                <p className="mb-6">
                  Fue creado hace 15 años por <strong>Iván Mazo</strong>, un experimentado asesor empresarial, conferencista de carácter internacional, Investigador; estudioso incansable de la sociología, la antropología y la filosofía. Un pensador profundo e irreverente que con sabiduría cuestiona y confronta el conocimiento convencional que nos tiene tan sometidos a viejos modelos mentales.
                </p>
                <p className="mb-6">
                  La Escuela de La Riqueza se fundó con la finalidad de entregarle al mundo un nuevo modelo de empresarios, que tengan la capacidad de potenciar su inteligencia, transformar su mentalidad, ser más íntegros, creativos y sobre todo comprometidos con la humanidad y sus cambios constantes.
                </p>
                <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-white/5 border border-white/10">
                  <Target className="text-gold shrink-0" size={20} />
                  <p className="text-sm sm:text-base m-0 text-white/90">
                    Más de <strong>1600 empresarios</strong> en Colombia se han formado en esta escuela y el programa es tan efectivo y confiable que existen personas que lo han repetido en múltiples ocasiones.
                  </p>
                </div>
              </div>

              <div className="md:col-span-4">
                <div className="sticky top-28 bg-black/40 border border-white/10 rounded-2xl p-6 sm:p-8 hover:border-gold/30 transition-colors mt-2 md:mt-14">
                  <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center mb-6">
                    <Lightbulb className="text-gold" size={24} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-4 leading-snug">
                    ¿Qué nos diferencia de otros programas empresariales?
                  </h3>
                  <p className="text-textMuted text-sm sm:text-base leading-relaxed m-0">
                    Nuestro contenido está basado en el estudio y un nuevo descubrimiento que conecta la inteligencia para desarrollar en el empresario una <strong>mentalidad de talla mundial</strong>, no en sumar conocimiento enciclopédico.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HistoryPage;
