import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, User, Lightbulb, Target } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Stream } from "@cloudflare/stream-react";

const HistoryPage = () => {
  const [isVideoInteracted, setIsVideoInteracted] = useState(false);

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

          <div className="mb-10 text-lg sm:text-2xl text-gold italic font-serif leading-relaxed border-l-4 border-gold pl-6 py-2">
            “La riqueza es una consecuencia de la transformación mental, del carácter, de la conciencia y de la manera de servir al mundo”.
          </div>

          <div className="prose prose-invert max-w-none prose-p:text-textMuted prose-p:leading-relaxed prose-p:text-base sm:prose-p:text-lg">
            <p>
              La Escuela de la riqueza es un programa de rediseño cerebral basado en el uso de la inteligencia en su máxima expresión. Enseñamos todo lo que no se enseña en la academia cuya función es preparar sólo la mente racional. De ningún modo los contenidos de la academia tradicional preparan al empresario; la academia es muy buena para preparar gerentes y administradores, no empresarios.
            </p>
            <p>
              La Escuela de la Riqueza está orientada a transformar la mentalidad del empresario y del directivo para que desarrolle una mente cósmica, de carácter mundial que lo lleve a concebir la innovación mental como el fundamento de su nuevo modelo de pensar la vida empresarial y la competitividad de este exigente siglo XXI.
            </p>

            <div 
              className="my-12 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(204,164,59,0.15)] border border-white/10 relative bg-black aspect-video group"
              onMouseLeave={() => setIsVideoInteracted(false)}
            >
              {!isVideoInteracted && (
                <div 
                  className="absolute inset-0 z-10 cursor-pointer"
                  onClick={() => setIsVideoInteracted(true)}
                  title="Haz clic para interactuar con el video"
                />
              )}
              <Stream
                src="6c7dbd66798d0c85e0e1fb0689916a8c"
                controls
                preload="metadata"
                responsive={false}
                className="w-full h-full border-none absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:absolute [&>iframe]:inset-0"
              />
            </div>

            <div className="space-y-16 mt-16">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 flex items-center gap-3">
                  <User className="text-gold" size={28} />
                  ¿Quién fundó La Escuela de la Riqueza?
                </h2>
                <p>
                  Es un programa único en su genero, radicalmente innovador en sus contenidos, creado por Iván Mazo Mejía hace 15 años, consultor y asesor empresarial desde hace 27 años en varios países de América y con experiencia en todo tipo de industrias.
                </p>
                <p>
                  Dicha experiencia me permite plantear este rediseño cerebral en función de entregarle al mundo un nuevo modelo de empresario que potencia su inteligencia de una manera más integradora, más creadora, y sobre todo más comprometida con la nueva competitividad mundial.
                </p>
                <p>
                  La Escuela de la Riqueza enseña al empresario a ver de una forma totalmente diferente la realidad que vive, lo dota de conceptos que le generan grandes transformaciones mentales de tal manera que al terminar el ciclo ya no vuelve a ser el mismo que llegó.
                </p>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 flex items-center gap-3">
                  <Target className="text-gold" size={28} />
                  Para quién es la Escuela de la Riqueza
                </h2>
                <p>
                  <strong>Escuela de la Riqueza:</strong> es un innovador programa de formación para empresarios que se toman la vida con carácter y poder. Aunque usted tenga una empresa es posible que su vida no sea la de un empresario, eso ocurre demasiado y es uno de los aspectos que más bloquea la riqueza.
                </p>
                <p>
                  Escuela de la Riqueza acoge a jóvenes que están soñando su vida como empresarios. Nuestro revolucionario programa despierta el genio creador que cada joven lleva dentro.
                </p>
                <p>
                  Por la Escuela de la Riqueza pasan profesionales de todas las disciplinas que se ven enfrentadas a la realidad de formar empresa y no saben qué pasos dar, cómo se pueden proyectar, hacia donde deben dirigir sus esfuerzos, en qué se deben centrar sus acciones de cada día.
                </p>
              </div>
            </div>

            <div className="mt-20 p-8 sm:p-12 bg-gold/5 border border-gold/20 rounded-3xl text-center relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
              <h3 className="text-xl sm:text-3xl font-serif italic text-white leading-relaxed relative z-10 m-0">
                “La verdadera riqueza no es cuánto dinero produces, sino en quién te conviertes mientras lo produces”.
              </h3>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HistoryPage;
