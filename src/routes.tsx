import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useScrollToHash } from "@/hooks/useScrollToHash";
import LandingPage from "@/pages/public/LandingPage";
import RequireAuth from "@/components/layout/RequireAuth";

// Solo la landing viaja en el paquete inicial: es la puerta de entrada. El resto
// se descarga al visitar su ruta — antes TODO (admin, gráficos, hls.js, el
// subidor de videos) se bajaba aunque el visitante solo mirara la portada.
const AuthPage = lazy(() => import("@/pages/public/AuthPage"));
const ResetPassword = lazy(() => import("@/pages/public/ResetPassword"));
const EmailConfirmed = lazy(() => import("@/pages/public/EmailConfirmed"));
const Plans = lazy(() => import("@/pages/public/Plans"));
const NotFound = lazy(() => import("@/pages/public/NotFound"));
const HistoryPage = lazy(() => import("@/pages/public/HistoryPage"));
const TermsPage = lazy(() => import("@/pages/public/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/public/PrivacyPage"));
const ModulePreview = lazy(() => import("@/pages/public/ModulePreview"));
const MaintenancePage = lazy(() => import("@/pages/public/MaintenancePage"));
const PublicLiveRoom = lazy(() => import("@/pages/public/PublicLiveRoom"));
const StudentDashboard = lazy(() => import("@/pages/student/StudentDashboard"));
const VIPLiveRoom = lazy(() => import("@/pages/student/VIPLiveRoom"));
const ReplayViewer = lazy(() => import("@/pages/student/ReplayViewer"));
const AdminLayout = lazy(() => import("@/components/layout/AdminLayout"));
const AdminMetrics = lazy(() => import("@/pages/admin/AdminMetrics"));
const AdminContentManager = lazy(() => import("@/pages/admin/AdminContentManager"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminUserDetail = lazy(() => import("@/pages/admin/AdminUserDetail"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminLiveManager = lazy(() => import("@/pages/admin/AdminLiveManager"));
const AdminSponsors = lazy(() => import("@/pages/admin/AdminSponsors"));
const AdminErrors = lazy(() => import("@/pages/admin/AdminErrors"));
import { USER_ROLES } from "@/types/user";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useAuthStore } from "@/stores/auth.store";

/**
 * Transición entre páginas.
 *
 * Anima SOLO `opacity` a propósito. `filter` y `transform` convierten a este div en
 * containing block mientras están activos, y eso hace que cualquier `position: fixed`
 * de la app se ancle acá en lugar de al viewport (rompía, por ejemplo, la pantalla
 * completa del anuncio en el reproductor). No agregar blur ni desplazamientos acá.
 */
const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3, ease: "easeInOut" }}
    className="w-full min-h-[100dvh]"
  >
    {/* Cada página se baja al visitarla: mientras llega, el lienzo queda con el
        fondo del tema (sin spinner — suele tardar menos que la propia transición). */}
    <Suspense fallback={null}>{children}</Suspense>
  </motion.div>
);

/**
 * Rutas que siguen siendo accesibles durante el modo mantenimiento:
 * - `/login` para que el admin pueda entrar.
 * - `/admin/**` para que el admin pueda desactivar el modo mantenimiento.
 * - `/cuenta-verificada` para no romper links de confirmación de email.
 * - `/live/:token` para que un link público compartido siga funcionando.
 */
const MAINTENANCE_ALLOWED_PREFIXES = ["/login", "/admin", "/cuenta-verificada", "/live"];

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

        {/* Link público de live — sin login, gateado por share_token en la RPC */}
        <Route path="/live/:token" element={<PageTransition><PublicLiveRoom /></PageTransition>} />

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

        {/* Grabación de la escuela — visibilidad validada por RPC y por /api/stream/recording-url */}
        <Route
          path="/grabaciones/:liveId"
          element={
            <RequireAuth>
              <PageTransition><ReplayViewer /></PageTransition>
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
          <Route path="sponsors" element={<AdminSponsors />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="errors" element={<AdminErrors />} />
        </Route>

        {/* 404 catch-all */}
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

export default AppRoutes;
