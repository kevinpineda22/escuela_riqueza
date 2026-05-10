import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { supabase } from "@/lib/supabase";
import AnimationToggle from "@/components/feature/AnimationToggle";

const LOGO_URL =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

const getInitials = (name: string) => {
  if (!name) return "US";
  const words = name.trim().split(" ");
  if (words.length >= 2) {
    return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const Header = () => {
  const navigate = useNavigate();
  const { user, clearSession } = useAuthStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSession();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-darker/85 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand: solo logo — ya dice "Escuela de la Riqueza" */}
        <Link
          to="/"
          className="flex items-center group shrink-0"
          title="Escuela de la Riqueza — Inicio"
          aria-label="Escuela de la Riqueza — Inicio"
        >
          <img
            src={LOGO_URL}
            alt="Escuela de la Riqueza"
            className="h-12 sm:h-14 w-auto drop-shadow-[0_0_12px_rgba(204,164,59,0.25)] group-hover:scale-105 transition-transform"
          />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <AnimationToggle />

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/dashboard?tab=perfil"
                className="flex items-center gap-2 group"
                title="Ir a mi panel"
              >
                <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center overflow-hidden">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gold text-sm font-bold">
                      {getInitials(user.fullName || "User")}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-white/80 group-hover:text-gold transition-colors hidden md:block">
                  Mi panel
                </span>
              </Link>

              {user.role === "admin" && (
                <Link
                  to="/admin/content"
                  className="hidden sm:flex text-sm font-bold text-darker bg-gold hover:bg-goldHover px-4 py-1.5 rounded-full items-center gap-2 transition-all shadow-[0_0_10px_rgba(204,164,59,0.3)]"
                >
                  Vista admin
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="text-sm font-medium text-white/60 hover:text-red-400 transition-colors flex items-center gap-1.5"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={16} />
                <span className="hidden md:inline">Salir</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="bg-gold hover:bg-goldHover text-darker text-sm font-bold px-4 sm:px-6 py-2 rounded-full transition-all shadow-[0_0_15px_rgba(204,164,59,0.3)] hover:shadow-[0_0_20px_rgba(204,164,59,0.5)] hover:-translate-y-0.5 whitespace-nowrap"
            >
              Iniciar sesión
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
