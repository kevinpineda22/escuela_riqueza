import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const PrivacyPage = () => {
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
            <Shield size={14} className="text-white/70" />
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-bold text-white/70">
              Legal
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            Política de Privacidad
          </h1>
          <p className="text-textMuted text-sm sm:text-base mb-12">
            Última actualización: {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </p>

          <div className="prose prose-invert max-w-none prose-p:text-textMuted prose-p:leading-relaxed prose-h2:text-white prose-h2:font-bold prose-h2:mt-12 prose-h2:mb-4">
            <p>
              En Escuela de la Riqueza, valoramos y respetamos tu privacidad. Esta política de privacidad explica cómo
              recopilamos, usamos, compartimos y protegemos tu información personal cuando utilizas nuestra plataforma
              educativa y los servicios asociados.
            </p>

            <h2>1. Información que Recopilamos</h2>
            <p>
              Recopilamos información que nos proporcionas directamente, como tu nombre, dirección de correo electrónico
              y detalles de la cuenta cuando te registras. Además, recopilamos automáticamente ciertos datos sobre tu
              dispositivo y tu uso de la plataforma, incluyendo tu dirección IP, tipo de navegador, y las lecciones o
              módulos con los que interactúas.
            </p>

            <h2>2. Uso de tu Información</h2>
            <p>
              Utilizamos la información recopilada para:
            </p>
            <ul>
              <li>Proveer, operar y mantener nuestra plataforma y servicios.</li>
              <li>Procesar tus transacciones y enviarte notificaciones relacionadas, incluyendo confirmaciones de pago.</li>
              <li>Personalizar tu experiencia de aprendizaje y recomendarte contenidos.</li>
              <li>Comunicarnos contigo acerca de actualizaciones, ofertas y nuevos cursos.</li>
              <li>Mejorar continuamente nuestra plataforma mediante análisis de datos de uso.</li>
            </ul>

            <h2>3. Compartir tu Información</h2>
            <p>
              No vendemos ni alquilamos tu información personal a terceros. Podemos compartir tu información con proveedores
              de servicios externos que nos ayudan a operar la plataforma (por ejemplo, pasarelas de pago como Stripe o servicios 
              de infraestructura en la nube). Estos proveedores están obligados a proteger tu información y solo pueden utilizarla 
              para los fines específicos para los cuales los contratamos.
            </p>

            <h2>4. Seguridad de los Datos</h2>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas diseñadas para proteger tu información personal contra
              el acceso, alteración, divulgación o destrucción no autorizados. Sin embargo, ningún método de transmisión por
              Internet o almacenamiento electrónico es 100% seguro, por lo que no podemos garantizar una seguridad absoluta.
            </p>

            <h2>5. Tus Derechos</h2>
            <p>
              Dependiendo de tu jurisdicción, puedes tener derechos sobre tu información personal, incluyendo el derecho a acceder,
              corregir, eliminar o restringir el uso de tus datos. Puedes gestionar muchas de estas preferencias directamente desde
              la configuración de tu perfil en la plataforma o contactándonos.
            </p>

            <h2>6. Cambios en esta Política</h2>
            <p>
              Podemos actualizar nuestra Política de Privacidad de vez en cuando. Te notificaremos sobre cualquier cambio publicando
              la nueva Política de Privacidad en esta página y, cuando corresponda, mediante una notificación por correo electrónico.
            </p>

            <div className="mt-12 p-6 rounded-xl bg-white/[0.02] border border-white/5">
              <h3 className="text-white font-bold mb-2">Contacto sobre Privacidad</h3>
              <p className="text-sm text-textMuted mb-0">
                Si tienes preguntas o inquietudes sobre nuestra política de privacidad, por favor contáctanos en{' '}
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

export default PrivacyPage;
