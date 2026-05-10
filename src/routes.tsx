import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "@/pages/public/LandingPage";
import AuthPage from "@/pages/public/AuthPage";
import ResetPassword from "@/pages/public/ResetPassword";
import NotFound from "@/pages/public/NotFound";
import LessonViewer from "@/pages/student/LessonViewer";
import StudentDashboard from "@/pages/student/StudentDashboard";
import VIPLiveRoom from "@/pages/student/VIPLiveRoom";
import AdminMetrics from "@/pages/admin/AdminMetrics";
import AdminContentManager from "@/pages/admin/AdminContentManager";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminLiveManager from "@/pages/admin/AdminLiveManager";
import RequireAuth from "@/components/layout/RequireAuth";
import AdminLayout from "@/components/layout/AdminLayout";
import { PLANS, USER_ROLES } from "@/types/user";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/leccion" element={<LessonViewer />} />
      <Route path="/login" element={<AuthPage initialMode="signin" />} />
      <Route path="/registro" element={<AuthPage initialMode="signup" />} />
      <Route path="/recuperar-contrasena" element={<AuthPage initialMode="forgot" />} />
      <Route path="/restablecer-contrasena" element={<ResetPassword />} />

      {/* Estudiantes (cualquier plan logueado) */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <StudentDashboard />
          </RequireAuth>
        }
      />

      {/* VIP only */}
      <Route
        path="/vip-live"
        element={
          <RequireAuth minPlan={PLANS.VIP}>
            <VIPLiveRoom />
          </RequireAuth>
        }
      />

      {/* Admin Layout y Sub-rutas */}
      <Route
        path="/admin"
        element={
          <RequireAuth role={USER_ROLES.ADMIN}>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/admin/content" replace />} />
        <Route path="metrics" element={<AdminMetrics />} />
        <Route path="content" element={<AdminContentManager />} />
        <Route path="lives" element={<AdminLiveManager />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* 404 catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
