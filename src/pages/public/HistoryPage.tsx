import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, BookOpen } from "lucide-react";
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
        className="hidden md:block fixed top-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-gold opacity-[0.1] blur-[150px] pointer-events-none"
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

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-8">
            El rediseño cerebral que{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic">
              transforma vidas
            </span>
          </h1>

          <div className="prose prose-invert max-w-none prose-p:text-textMuted prose-p:leading-relaxed prose-p:text-base sm:prose-p:text-lg">
            <p className="mb-8">
              La <strong>Escuela de la Riqueza</strong> no es solo una plataforma educativa; es un movimiento
              impulsado por la visión de Iván Mazo de transformar el paradigma mental de emprendedores y
              profesionales. Entendemos que el verdadero cambio no proviene de tácticas superficiales, sino
              de un profundo <strong>rediseño cerebral</strong> que alinea tus pensamientos con tus objetivos de vida y negocio.
            </p>

            <div className="my-12 rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative bg-black aspect-video">
              <Stream
                src="6c7dbd66798d0c85e0e1fb0689916a8c"
                controls
                responsive
                preload="metadata"
                className="w-full h-full object-cover"
              />
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-12 mb-6 flex items-center gap-3">
              <BookOpen className="text-gold" size={24} />
              Nuestra Filosofía
            </h2>
            <p className="mb-6">
              Nacimos con el propósito de ofrecer un enfoque radicalmente diferente. A través del estudio de las 
              <strong> 6 inteligencias</strong> (Financiera, Emocional, Social, Comercial, Espiritual y Física), 
              proveemos a nuestros estudiantes de las herramientas necesarias para construir una riqueza integral.
            </p>
            <p className="mb-6">
              Creemos firmemente que el conocimiento es la moneda definitiva de este siglo. Por eso, hemos diseñado 
              una experiencia educativa donde la teoría se encuentra con la práctica a través de lecciones en video, 
              modo podcast para aprendizaje en movimiento y sesiones en vivo exclusivas donde resolvemos los desafíos 
              reales de nuestra comunidad.
            </p>

            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-12 mb-6">
              Únete a la Revolución
            </h2>
            <p>
              Ya sea que estés dando tus primeros pasos como emprendedor o busques escalar tu negocio al siguiente nivel, 
              la Escuela de la Riqueza está diseñada para acompañarte. Al formar parte de nuestra comunidad, no solo accedes 
              a contenido premium, sino a una red de individuos comprometidos con su propia excelencia.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HistoryPage;
