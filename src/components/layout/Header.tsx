import { Link, useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { supabase } from "@/lib/supabase";

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
    <header className="sticky top-0 z-50 w-full bg-darker/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group" title="Volver al inicio">
          <img
            src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
            alt="Escuela de la Riqueza"
            className="h-12 drop-shadow-md group-hover:scale-105 transition-transform"
          />
        </Link>

        <nav className="flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-4">
              <Link 
                to="/dashboard?tab=perfil"
                className="flex items-center gap-3 group"
                title="Ir a mi perfil"
              >
                <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gold text-sm font-bold">{getInitials(user.fullName || "User")}</span>
                  )}
                </div>
                <span className="text-sm font-medium text-white/80 group-hover:text-gold transition-colors hidden sm:block">
                  Mi Panel
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-white/50 hover:text-red-400 transition-colors flex items-center gap-2 ml-2"
                title="Cerrar Sesión"
              >
                <LogOut size={16} />
                <span className="hidden sm:block">Salir</span>
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="text-sm font-bold text-white hover:text-gold transition-colors">
                Ingresar
              </Link>
              <Link
                to="/registro"
                className="bg-gold hover:bg-goldHover text-darker text-sm font-bold px-5 py-2.5 rounded-full transition-all shadow-[0_0_15px_rgba(204,164,59,0.3)] hover:shadow-[0_0_20px_rgba(204,164,59,0.5)] hover:-translate-y-0.5"
              >
                Comenzar
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
