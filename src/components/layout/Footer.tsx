import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-darker border-t border-white/5 py-12 relative z-10 w-full mt-20">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="col-span-1 md:col-span-2">
          <Link to="/" className="inline-block mb-4">
            <img
              src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
              alt="Logo Escuela de la Riqueza"
              className="h-16 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity drop-shadow-md"
            />
          </Link>
          <p className="text-textMuted text-sm max-w-sm mt-2">
            Nuestra misión es llevar el conocimiento de más alto nivel a todos los emprendedores. Aprende directamente
            de la experiencia de los mejores, y transórmate para alcanzar tu inteligencia espiritual, comercial y de
            riqueza.
          </p>
        </div>

        {/* Links */}
        <div>
          <h4 className="text-white font-semibold mb-4">Plataforma</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <a href="#historia" className="text-textMuted hover:text-gold transition-colors">
                Nuestra Historia
              </a>
            </li>
            <li>
              <a href="#modulos" className="text-textMuted hover:text-gold transition-colors">
                Explorar Módulos
              </a>
            </li>
            <li>
              <a href="#planes" className="text-textMuted hover:text-gold transition-colors">
                Planes y Precios
              </a>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="text-white font-semibold mb-4">Ayuda y Legal</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/soporte" className="text-textMuted hover:text-gold transition-colors">
                Soporte Técnico
              </Link>
            </li>
            <li>
              <Link to="/terminos" className="text-textMuted hover:text-gold transition-colors">
                Términos de Servicio
              </Link>
            </li>
            <li>
              <Link to="/privacidad" className="text-textMuted hover:text-gold transition-colors">
                Privacidad
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-white/5 text-center text-xs text-textMuted">
        © {new Date().getFullYear()} Escuela de la Riqueza. Todos los derechos reservados.
      </div>
    </footer>
  );
};

export default Footer;
