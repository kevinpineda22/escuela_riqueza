 import React from 'react';
import { PlayCircle, Target, Award, ChevronRight, BookOpen, Brain, Briefcase, Heart, Lightbulb, Map, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

const LandingPage = () => {
  const modulos = [
    { id: 1, titulo: "Inteligencia Mental", icono: <BookOpen className="text-gold w-8 h-8" /> },
    { id: 2, titulo: "Inteligencia de la riqueza", icono: <Target className="text-gold w-8 h-8" /> },
    { id: 3, titulo: "Inteligencia emocional", icono: <Heart className="text-gold w-8 h-8" /> },
    { id: 4, titulo: "Inteligencia Comercial y Negociadora", icono: <Briefcase className="text-gold w-8 h-8" /> },
    { id: 5, titulo: "Inteligencia Estratégica", icono: <Map className="text-gold w-8 h-8" /> },
    { id: 6, titulo: "Inteligencia Espiritual", icono: <Lightbulb className="text-gold w-8 h-8" /> },
  ];

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-darker selection:bg-gold/30 font-sans text-textMain">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>
      <div className="absolute top-0 right-0 -z-10 m-auto h-[600px] w-[600px] rounded-full bg-gold opacity-[0.15] blur-[150px]"></div>
      
      <Header />

      {/* Hero Section con la imagen de Ivan */}
      <section id="historia" className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-8 lg:gap-16 px-6 pt-24 pb-20 max-w-7xl mx-auto min-h-[90vh]">
        <div className="w-full md:w-1/2 flex flex-col items-center md:items-start text-center md:text-left z-20">
          <h1 className="text-4xl md:text-5xl lg:text-[4rem] font-extrabold tracking-tighter mb-10 text-white leading-tight drop-shadow-2xl">
            Una escuela de <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic pr-2">rediseño cerebral</span> <br className="hidden lg:block" />
            para que te conviertas en el <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic pr-2">gigante mental</span> <br className="hidden lg:block" />
            que llevas dentro.
          </h1>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="#modulos" className="px-10 py-5 text-lg bg-gold hover:bg-goldHover text-darker font-bold rounded-full transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,164,59,0.4)] hover:scale-105 hover:shadow-[0_0_40px_rgba(204,164,59,0.6)]">
              Descubrir Módulos <ChevronRight size={20} />
            </a>
          </div>
        </div>

        {/* Imagen de Ivan */}
        <div className="w-full md:w-1/2 flex justify-center items-center mt-16 md:mt-0 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-darker via-transparent opacity-80 z-10"></div>
          <img 
            src="/ivan.webp" 
            alt="Iván - Representante" 
            className="w-[90%] md:w-full max-w-lg lg:max-w-xl xl:max-w-2xl object-contain relative z-0 mix-blend-lighten filter drop-shadow-[0_0_30px_rgba(204,164,59,0.2)] hover:scale-105 transition-transform duration-700"
          />
        </div>
      </section>

      {/* Módulos de Aprendizaje */}
      <section id="modulos" className="relative z-10 max-w-7xl mx-auto px-6 py-24 border-t border-white/5">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Nuestra Vía de Crecimiento</h2>
          <p className="text-textMuted max-w-xl mx-auto text-lg">Seis inteligencias críticas para escalar tu capacidad y transformar tu visión, con clases gratuitas llenas de valor.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modulos.map((modulo) => (
            <Link key={modulo.id} to="/leccion" className="block group p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-md hover:bg-white/[0.05] hover:border-gold/30 transition-all duration-300">
              <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-gold/20 transition-all">
                {modulo.icono}
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">{modulo.titulo}</h3>
              <p className="text-textMuted leading-relaxed">
                Lecciones pre-grabadas en formato masterclass para potenciar esta área vital de forma directa y al grano.
              </p>
              <div className="mt-6 flex items-center text-sm font-medium text-gold gap-2 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all">
                Explorar Lecciones <PlayCircle size={16} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Planes Section */}
      <section id="planes" className="relative z-10 max-w-7xl mx-auto px-6 py-24 border-t border-white/5">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Elige tu Plan de Crecimiento</h2>
          <p className="text-textMuted max-w-xl mx-auto text-lg">Impulsa tu desarrollo al nivel que necesitas. Comienza gratis o accede a la experiencia completa.</p>
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
            <button className="w-full py-3 mb-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all">Empezar Gratis</button>
            <ul className="space-y-4">
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-textMuted">Contenido introductorio seleccionado</span></li>
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-textMuted">Anuncios de empresarios aliados</span></li>
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-textMuted">Acceso limitado a la comunidad</span></li>
            </ul>
          </div>

          {/* Individual */}
          <div className="p-8 rounded-3xl bg-darker border-2 border-gold relative transform lg:-translate-y-4 shadow-[0_0_30px_rgba(204,164,59,0.15)]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gold text-darker text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">Más Elegido</div>
            <h3 className="text-2xl font-bold text-white mb-2">Individual</h3>
            <p className="text-textMuted text-sm mb-6 h-10">Transformación personal profunda y sin interrupciones.</p>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-xl text-textMuted">Mensual o Anual</span>
            </div>
            <button className="w-full py-3 mb-8 rounded-xl bg-gold hover:bg-goldHover text-darker font-bold transition-all shadow-[0_0_15px_rgba(204,164,59,0.4)]">Suscribirse Ahora</button>
            <ul className="space-y-4">
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-white">Todo el contenido sin anuncios</span></li>
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-white">Modo Podcast habilitado</span></li>
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-white">Notas personales y barra progreso</span></li>
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-white">Certificados digitales</span></li>
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-white">Acceso completo a la comunidad</span></li>
            </ul>
          </div>

          {/* Grupal / VIP */}
          <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-md">
            <h3 className="text-2xl font-bold text-white mb-2">Grupal / VIP</h3>
            <p className="text-textMuted text-sm mb-6 h-10">Para equipos empresariales y líderes de alto nivel.</p>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-xl text-textMuted">Empresarial a medida</span>
            </div>
            <button className="w-full py-3 mb-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all">Contactar Ventas</button>
            <ul className="space-y-4">
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-textMuted">Todo lo del plan Individual</span></li>
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-textMuted">Videoconferencias 1 a 1 con Iván</span></li>
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-textMuted">Consultoría grupal exclusiva</span></li>
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-textMuted">Descuento en eventos presenciales</span></li>
              <li className="flex items-start gap-3"><Check className="text-gold w-5 h-5 shrink-0" /><span className="text-sm text-textMuted">Soporte prioritario</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer del sitio */}
      <Footer />
    </div>
  );
};

export default LandingPage;