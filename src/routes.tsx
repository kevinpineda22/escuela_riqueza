import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useScrollToHash } from "@/hooks/useScrollToHash";
import LandingPage from "@/pages/public/LandingPage";
import AuthPage from "@/pages/public/AuthPage";
import ResetPassword from "@/pages/public/ResetPassword";
import EmailConfirmed from "@/pages/public/EmailConfirmed";
import Plans from "@/pages/public/Plans";
import NotFound from "@/pages/public/NotFound";
import HistoryPage from "@/pages/public/HistoryPage";
import TermsPage from "@/pages/public/TermsPage";
import PrivacyPage from "@/pages/public/PrivacyPage";
import ModulePreview from "@/pages/public/ModulePreview";
import MaintenancePage from "@/pages/public/MaintenancePage";
import StudentDashboard from "@/pages/student/StudentDashboard";
import VIPLiveRoom from "@/pages/student/VIPLiveRoom";
import AdminMetrics from "@/pages/admin/AdminMetrics";
import AdminContentManager from "@/pages/admin/AdminContentManager";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminUserDetail from "@/pages/admin/AdminUserDetail";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminLiveManager from "@/pages/admin/AdminLiveManager";
import RequireAuth from "@/components/layout/RequireAuth";
import AdminLayout from "@/components/layout/AdminLayout";
import { USER_ROLES } from "@/types/user";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useAuthStore } from "@/stores/auth.store";

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, filter: "blur(4px)" }}
    animate={{ opacity: 1, filter: "blur(0px)" }}
    exit={{ opacity: 0, filter: "blur(4px)" }}
    transition={{ duration: 0.3, ease: "easeInOut" }}
    className="w-full min-h-[100dvh]"
  >
    {children}
  </motion.div>
);

/**
 * Rutas que siguen siendo accesibles durante el modo mantenimiento:
 * - `/login` para que el admin pueda entrar.
 * - `/admin/**` para que el admin pueda desactivar el modo mantenimiento.
 * - `/cuenta-verificada` para no romper links de confirmación de email.
 */
const MAINTENANCE_ALLOWED_PREFIXES = ["/login", "/admin", "/cuenta-verificada"];

const isMaintenanceAllowedPath = (pathname: string) =>
  MAINTENANCE_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const AppRoutes = () => {
  const location = useLocation();
  useScrollToHash();
  const { data: settings } = usePlatformSettings();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const maintenanceActive =
    settings?.maintenance_mode === true &&
    !isAdmin &&
    !isMaintenanceAllowedPath(location.pathname);

  if (maintenanceActive) {
    return (
      <AnimatePresence mode="wait">
        <PageTransition key="maintenance">
          <MaintenancePage />
        </PageTransition>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname.split("/")[1] || "/"}>
        {/* Públicas */}
        <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />
        <Route path="/login" element={<PageTransition><AuthPage initialMode="signin" /></PageTransition>} />
        <Route path="/registro" element={<PageTransition><AuthPage initialMode="signup" /></PageTransition>} />
        <Route path="/recuperar-contrasena" element={<PageTransition><AuthPage initialMode="forgot" /></PageTransition>} />
        <Route path="/restablecer-contrasena" element={<PageTransition><ResetPassword /></PageTransition>} />
        <Route path="/cuenta-verificada" element={<PageTransition><EmailConfirmed /></PageTransition>} />
        <Route path="/planes" element={<PageTransition><Plans /></PageTransition>} />
        <Route path="/historia" element={<PageTransition><HistoryPage /></PageTransition>} />
        <Route path="/terminos" element={<PageTransition><TermsPage /></PageTransition>} />
        <Route path="/privacidad" element={<PageTransition><PrivacyPage /></PageTransition>} />
        <Route path="/explorar/:intelligenceId" element={<PageTransition><ModulePreview /></PageTransition>} />

        {/* Estudiantes (cualquier plan logueado) */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <PageTransition><StudentDashboard /></PageTransition>
            </RequireAuth>
          }
        />

        {/* Sala de en vivo — acceso validado por allowed_plans del active live */}
        <Route
          path="/vip-live"
          element={
            <RequireAuth>
              <PageTransition><VIPLiveRoom /></PageTransition>
            </RequireAuth>
          }
        />

        {/* Admin Layout y Sub-rutas */}
        <Route
          path="/admin"
          element={
            <RequireAuth role={USER_ROLES.ADMIN}>
              <PageTransition><AdminLayout /></PageTransition>
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/admin/content" replace />} />
          <Route path="metrics" element={<AdminMetrics />} />
          <Route path="content" element={<AdminContentManager />} />
          <Route path="lives" element={<AdminLiveManager />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:id" element={<AdminUserDetail />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* 404 catch-all */}
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

export default AppRoutes;
