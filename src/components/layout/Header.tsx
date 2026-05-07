import { Link } from "react-router-dom";

const Header = () => {
  return (
    <header className="relative z-10 w-full backdrop-blur-md border-b border-white/5 bg-darker/80 sticky top-0">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/LOGO-ESCUELA.webp"
            alt="Logo Escuela de la Riqueza"
            className="h-16 md:h-20 object-contain drop-shadow-md"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-1 justify-center gap-10">
          <a href="#historia" className="text-lg font-medium text-textMuted hover:text-gold transition-colors">
            Historia
          </a>
          <a href="#modulos" className="text-lg font-medium text-textMuted hover:text-gold transition-colors">
            Módulos
          </a>
          <a href="#planes" className="text-lg font-medium text-textMuted hover:text-gold transition-colors">
            Planes
          </a>
        </nav>

        {/* CTA (Ingresar) */}
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="px-8 py-3 text-lg font-medium bg-gold hover:bg-goldHover text-darker rounded-full transition-all shadow-[0_0_15px_rgba(204,164,59,0.3)]"
          >
            Ingresar
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
