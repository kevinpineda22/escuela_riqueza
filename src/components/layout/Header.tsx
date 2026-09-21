import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  LogOut,
  Menu,
  LayoutDashboard,
  ShieldCheck,
  UserPlus,
  LogIn,
  PlayCircle,
  Edit3,
  Award,
  Users as UsersIcon,
  User as UserIcon,
  Video,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { supabase } from "@/lib/supabase";
import { PLANS } from "@/types/user";
import { canAccessCertificates } from "@/lib/plans";
import AnimationToggle from "@/components/feature/AnimationToggle";
import AppearanceToggle from "@/components/feature/AppearanceToggle";
import BrandLogo from "@/components/layout/BrandLogo";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LOGO_FALLBACK =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

const getInitials = (name: string) => {
  if (!name) return "US";
  const words = name.trim().split(" ");
  if (words.length >= 2) {
    return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

interface DashboardTab {
  id: string;
  icon: typeof PlayCircle;
  label: string;
  premiumOnly?: boolean;
}

const DASHBOARD_TABS: DashboardTab[] = [
  { id: "modulos", icon: PlayCircle, label: "Módulos" },
  { id: "notas", icon: Edit3, label: "Notas personales" },
  { id: "certificados", icon: Award, label: "Certificado", premiumOnly: true },
  { id: "comunidad", icon: UsersIcon, label: "Comunidad VIP" },
  { id: "perfil", icon: UserIcon, label: "Mi Panel" },
];

const Header = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { user, clearSession } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: settings } = usePlatformSettings();
  const platformName = settings?.platform_name || "Escuela de la Riqueza";
  const logoUrl = settings?.logo_url || LOGO_FALLBACK;

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    await supabase.auth.signOut();
    clearSession();
    navigate("/");
  };

  const closeMenu = () => setIsMobileMenuOpen(false);
  const isAdmin = user?.role === "admin";
  const inDashboard = pathname.startsWith("/dashboard");
  const isVip = user?.plan === PLANS.VIP;
  const canSeeCertificates = canAccessCertificates(user?.plan, user?.role);
  const currentTab = searchParams.get("tab") || "modulos";

  return (
    <header className="sticky top-0 z-50 w-full bg-surface-page/85 backdrop-blur-md border-b border-line-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center group shrink-0"
          title={`${platformName} — Inicio`}
          aria-label={`${platformName} — Inicio`}
        >
          <BrandLogo
            src={logoUrl}
            alt={platformName}
            className="h-10 sm:h-12 md:h-14 w-auto drop-shadow-[0_0_12px_rgba(204,164,59,0.25)] group-hover:scale-105 transition-transform"
            plateClassName="light:py-1"
          />
        </Link>

        {/* Desktop nav — sm+ */}
        <nav className="hidden sm:flex items-center gap-2 sm:gap-3">
          <AnimationToggle />
          <AppearanceToggle />

          {isAdmin && (
            <Link
              to="/admin/content"
              className="text-sm font-bold text-on-brand bg-brand hover:bg-brand-hover px-4 py-1.5 rounded-full flex items-center gap-2 transition-all shadow-[0_0_10px_rgba(204,164,59,0.3)]"
            >
              Vista admin
            </Link>
          )}

          {!user ? (
            <Link
              to="/login"
              className="bg-brand hover:bg-brand-hover text-on-brand text-sm font-bold px-4 sm:px-6 py-2 rounded-full transition-all shadow-[0_0_15px_rgba(204,164,59,0.3)] hover:shadow-[0_0_20px_rgba(204,164,59,0.5)] hover:-translate-y-0.5 whitespace-nowrap"
            >
              Iniciar sesión
            </Link>
          ) : inDashboard ? (
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-fg-60 hover:text-danger transition-colors flex items-center gap-1.5"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
              <span className="hidden md:inline">Salir</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/dashboard?tab=modulos"
                className="flex items-center gap-2 group"
                title="Ir a mis módulos"
              >
                <div className="w-9 h-9 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center overflow-hidden">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-accent text-sm font-bold">
                      {getInitials(user.fullName || "User")}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-fg-80 group-hover:text-accent transition-colors hidden md:block">
                  Mis módulos
                </span>
              </Link>

              <button
                onClick={handleLogout}
                className="text-sm font-medium text-fg-60 hover:text-danger transition-colors flex items-center gap-1.5"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={16} />
                <span className="hidden md:inline">Salir</span>
              </button>
            </div>
          )}
        </nav>

        {/* Mobile nav — < sm */}
        <div className="flex sm:hidden items-center gap-2">
          {user && (
            <Link
              to="/dashboard?tab=modulos"
              className="w-9 h-9 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center overflow-hidden shrink-0"
              title="Mis módulos"
              aria-label="Mis módulos"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-accent text-xs font-bold">
                  {getInitials(user.fullName || "User")}
                </span>
              )}
            </Link>
          )}

          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-foreground-strong hover:bg-ink/10 h-9 w-9"
                aria-label="Abrir menú"
              >
                <Menu size={22} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[280px] sm:w-[320px] p-0 bg-surface-page/95 backdrop-blur-2xl border-l border-ink/[0.08] flex flex-col"
            >
              <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
              <SheetDescription className="sr-only">
                Acceso rápido a tu cuenta y secciones principales.
              </SheetDescription>

              {/* User card / brand */}
              <div className="px-6 pt-8 pb-6 border-b border-ink/5">
                <Link to="/" onClick={closeMenu} className="flex justify-center mb-5">
                  <BrandLogo
                    src={logoUrl}
                    alt={platformName}
                    className="h-12 w-auto drop-shadow-[0_0_12px_rgba(204,164,59,0.25)]"
                  />
                </Link>

                {user ? (
                  <div className="flex items-center gap-3 px-3 py-3 bg-ink/[0.03] rounded-2xl border border-ink/5 light:bg-surface-panel light:shadow-panel">
                    <div className="w-11 h-11 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center overflow-hidden shrink-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-accent text-sm font-bold">
                          {getInitials(user.fullName || "User")}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground-strong truncate">
                        {user.fullName || "Estudiante"}
                      </p>
                      <p className="text-[11px] text-accent/80 light:text-accent font-mono truncate uppercase tracking-wider">
                        {user.plan || "Free"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-xs text-foreground-muted">
                    Conoce las inteligencias del rediseño cerebral.
                  </p>
                )}
              </div>

              {/* Nav items */}
              <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
                {isAdmin && (
                  <Link
                    to="/admin/content"
                    onClick={closeMenu}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                      "bg-brand/10 text-accent border border-brand/20 hover:bg-brand/15"
                    )}
                  >
                    <ShieldCheck size={18} /> Vista admin
                  </Link>
                )}

                {user && !inDashboard && (
                  <Link
                    to="/dashboard?tab=modulos"
                    onClick={closeMenu}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-fg-80 hover:text-foreground-strong hover:bg-ink/5 transition-all"
                  >
                    <LayoutDashboard size={18} /> Ir a mi panel
                  </Link>
                )}

                {user && inDashboard && (
                  <>
                    <div className="px-4 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-fg-30">
                      Tu panel
                    </div>
                    {DASHBOARD_TABS.map((tab) => {
                      if (tab.premiumOnly && !canSeeCertificates) return null;
                      const isActive = currentTab === tab.id;
                      return (
                        <Link
                          key={tab.id}
                          to={`/dashboard?tab=${tab.id}`}
                          onClick={closeMenu}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                            isActive
                              ? "bg-ink/10 text-foreground-strong border border-line-subtle"
                              : "text-fg-80 hover:text-foreground-strong hover:bg-ink/5 border border-transparent"
                          )}
                        >
                          <tab.icon size={18} className={isActive ? "text-accent" : "text-fg-60"} />
                          {tab.label}
                        </Link>
                      );
                    })}

                    {isVip && (
                      <Link
                        to="/vip-live"
                        onClick={closeMenu}
                        className="mt-2 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all bg-red-600/10 text-danger hover:bg-red-600/20 border border-danger-line"
                      >
                        <div className="relative">
                          <Video size={18} />
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        </div>
                        Eventos en vivo
                      </Link>
                    )}
                  </>
                )}

                <div className="pt-3 mt-3 border-t border-ink/5">
                  <div className="px-4 py-3 space-y-4">
                    <AnimationToggle variant="labeled" />
                    <AppearanceToggle variant="labeled" />
                  </div>
                </div>
              </nav>

              {/* Footer del sheet */}
              <div className="p-4 border-t border-ink/5 space-y-2">
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-danger bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 transition-all"
                  >
                    <LogOut size={16} /> Cerrar sesión
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/login"
                      onClick={closeMenu}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-fg-80 bg-ink/[0.04] hover:bg-ink/[0.08] border border-line-subtle transition-all light:bg-surface-panel light:shadow-sm light:hover:bg-surface-subtle"
                    >
                      <LogIn size={14} /> Ingresar
                    </Link>
                    <Link
                      to="/registro"
                      onClick={closeMenu}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-on-brand bg-brand hover:bg-brand-hover transition-all shadow-[0_0_15px_rgba(204,164,59,0.25)]"
                    >
                      <UserPlus size={14} /> Crear cuenta
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;
