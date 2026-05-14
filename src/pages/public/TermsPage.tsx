import { Link } from "react-router-dom";
import { ArrowLeft, Scale } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const TermsPage = () => {
  return (
    <div className="min-h-[100dvh] relative bg-darker selection:bg-gold/30 font-sans text-textMain">
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"
      />
      
      <Header />

      <main className="relative pt-24 sm:pt-32 pb-16 sm:pb-24">
        <section className="max-w-3xl mx-auto px-5 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-textMuted hover:text-gold transition-colors mb-8"
          >
            <ArrowLeft size={14} /> Volver al inicio
          </Link>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
            <Scale size={14} className="text-white/70" />
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-bold text-white/70">
              Legal
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            Términos de Servicio
          </h1>
          <p className="text-textMuted text-sm sm:text-base mb-12">
            Última actualización: {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </p>

          <div className="prose prose-invert max-w-none prose-p:text-textMuted prose-p:leading-relaxed prose-h2:text-white prose-h2:font-bold prose-h2:mt-12 prose-h2:mb-4">
            <p>
              Bienvenido a Escuela de la Riqueza. Al acceder y utilizar nuestro sitio web y plataforma,
              aceptas cumplir y estar sujeto a los siguientes términos y condiciones de uso. Si no estás de
              acuerdo con alguna parte de estos términos, por favor no utilices nuestra plataforma.
            </p>

            <h2>1. Uso de la Plataforma</h2>
            <p>
              La plataforma Escuela de la Riqueza y su contenido original, características y funcionalidad son
              propiedad de Iván Mazo y están protegidos por derechos de autor, marcas registradas y otras leyes
              de propiedad intelectual. Tienes una licencia limitada, no exclusiva e intransferible para acceder 
              y utilizar la plataforma para tus fines educativos personales, según el plan al que te hayas suscrito.
            </p>

            <h2>2. Cuentas de Usuario</h2>
            <p>
              Para acceder a ciertas funciones de la plataforma, debes registrarte para obtener una cuenta. 
              Eres responsable de mantener la confidencialidad de la información de tu cuenta y contraseña.
              Aceptas notificar de inmediato cualquier uso no autorizado de tu cuenta o cualquier otra violación de seguridad.
            </p>

            <h2>3. Pagos y Suscripciones</h2>
            <p>
              Al seleccionar un plan de pago (Individual o VIP), aceptas pagar las tarifas mensuales o anuales 
              especificadas. Las suscripciones se renuevan automáticamente al final de cada ciclo de facturación 
              a menos que sean canceladas. Puedes cancelar tu suscripción en cualquier momento desde el panel 
              de configuración de tu cuenta.
            </p>

            <h2>4. Propiedad Intelectual</h2>
            <p>
              Todo el contenido presente en la Escuela de la Riqueza (incluyendo pero no limitado a videos, 
              audios, textos, gráficos, logos) es propiedad exclusiva. No se permite la reproducción, distribución, 
              modificación o uso comercial no autorizado de dicho contenido sin el consentimiento previo por escrito.
            </p>

            <h2>5. Limitación de Responsabilidad</h2>
            <p>
              La información proporcionada en la Escuela de la Riqueza tiene fines exclusivamente educativos e informativos. 
              No garantizamos resultados financieros, comerciales o personales específicos como resultado del uso de nuestra plataforma.
              Tu éxito depende de tu propio esfuerzo, dedicación y circunstancias individuales.
            </p>

            <h2>6. Cambios en los Términos</h2>
            <p>
              Nos reservamos el derecho de modificar estos términos de servicio en cualquier momento. 
              Notificaremos a los usuarios sobre cambios significativos a través de la plataforma o por correo electrónico. 
              Tu uso continuo de la plataforma después de dichos cambios constituye tu aceptación de los nuevos términos.
            </p>

            <div className="mt-12 p-6 rounded-xl bg-white/[0.02] border border-white/5">
              <h3 className="text-white font-bold mb-2">¿Tienes alguna pregunta?</h3>
              <p className="text-sm text-textMuted mb-0">
                Si tienes consultas sobre estos términos de servicio, puedes contactarnos en{' '}
                <a href="mailto:escueladelariquezaweb@gmail.com" className="text-gold hover:underline">
                  escueladelariquezaweb@gmail.com
                </a>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default TermsPage;
