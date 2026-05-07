import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  UploadCloud,
  LogOut,
  LayoutDashboard,
  Video,
  Users,
  Settings,
  Menu,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sidebarVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

const navItems = [
  { icon: LayoutDashboard, label: "Métricas", path: "/admin/metrics" },
  { icon: UploadCloud, label: "Cargar Lección", path: "/admin/upload" },
  { icon: Video, label: "Gestor de Contenido", path: "/admin/content" },
  { icon: Users, label: "Usuarios", path: "/admin/users" },
  { icon: Settings, label: "Ajustes", path: "/admin/settings" },
];

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Aquí iría la lógica de logout real
    if (onNavigate) onNavigate();
    navigate("/login");
  };

  return (
    <>
      <div className="px-6 mb-12 flex items-center justify-center pt-8 md:pt-0">
        <img
          src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
          alt="Logo Admin"
          className="h-14 object-contain drop-shadow-md"
        />
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {navItems.map((item, idx) => (
          <NavLink
            key={idx}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 w-full px-4 py-3.5 font-bold rounded-2xl transition-all overflow-hidden",
                isActive
                  ? "bg-gold/10 text-gold border border-gold/20 shadow-inner"
                  : "text-textMuted hover:text-white hover:bg-white/5 border border-transparent font-semibold"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-gold/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                )}
                <item.icon size={20} className="relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-white/5 space-y-4">
        {/* User Profile Indicator */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] rounded-2xl border border-white/5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gold to-amber-600 border-2 border-darker flex items-center justify-center text-sm font-extrabold text-darker shadow-[0_0_15px_rgba(204,164,59,0.4)] shrink-0">
            AD
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-white leading-tight truncate text-sm">Administrador VIP</p>
            <p className="text-[11px] text-gold font-mono truncate">admin@escuela.com</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="group relative flex items-center w-full px-4 py-3.5 text-textMuted hover:text-red-400 font-semibold rounded-2xl transition-all overflow-hidden border border-transparent hover:border-red-500/20 hover:bg-red-500/5 hover:shadow-[0_0_15px_rgba(239,68,68,0.1)]"
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-red-500/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
          <LogOut size={18} className="relative z-10 mr-3 transition-transform group-hover:-translate-x-1" />
          <span className="relative z-10">Cerrar Sesión</span>
        </button>
      </div>
    </>
  );
};

const AdminLayout = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#121212] via-[#1a1710] to-[#0a0a0a] flex flex-col md:flex-row text-textMain font-sans relative overflow-hidden selection:bg-gold/30">
      {/* Grid sutil de fondo */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      {/* Interactividad del mouse (Desktop) */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-0 hidden md:block"
        animate={{
          background: `radial-gradient(800px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(204,164,59,0.05), transparent 80%)`,
        }}
      />

      {/* Sidebar Desktop */}
      <motion.aside
        variants={sidebarVariants}
        initial="hidden"
        animate="visible"
        className="w-64 bg-darker/60 backdrop-blur-2xl border-r border-white/[0.05] flex-col pt-6 min-h-screen shrink-0 relative z-20 hidden md:flex shadow-[4px_0_24px_rgba(0,0,0,0.4)]"
      >
        <SidebarContent />
      </motion.aside>

      {/* Topbar Mobile */}
      <div className="md:hidden flex items-center justify-between p-4 bg-darker/80 backdrop-blur-md border-b border-white/[0.05] relative z-20">
        <img
          src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
          alt="Logo Admin"
          className="h-8 object-contain"
        />
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="Menú admin">
              <Menu size={24} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 bg-darker/95 backdrop-blur-2xl border-r border-white/[0.05] flex flex-col">
            <SheetTitle className="sr-only">Menú de Administración</SheetTitle>
            <SheetDescription className="sr-only">Navegación del panel administrativo.</SheetDescription>
            <SidebarContent onNavigate={() => setIsMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-12 relative z-10 overflow-y-auto h-[calc(100dvh-65px)] md:h-screen w-full flex flex-col">
        {/* Orbe flotante en el main (compartido por todas las vistas admin) */}
        <motion.div
          animate={{ y: [0, -20, 0], scale: [1, 1.05, 1], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[10%] right-[10%] -z-10 w-[500px] h-[500px] rounded-full bg-gold blur-[120px] pointer-events-none"
        />

        {/* Outlet renderiza la vista activa (Upload, Metrics, etc) */}
        <div className="flex-1 w-full max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
