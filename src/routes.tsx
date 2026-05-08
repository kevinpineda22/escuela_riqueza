import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "@/pages/public/LandingPage";
import Login from "@/pages/public/Login";
import Signup from "@/pages/public/Signup";
import LessonViewer from "@/pages/student/LessonViewer";
import Dashboard from "@/pages/student/Dashboard";
import VIPLiveRoom from "@/pages/student/VIPLiveRoom";
import AdminVideoUpload from "@/pages/admin/AdminVideoUpload";
import AdminMetrics from "@/pages/admin/AdminMetrics";
import AdminContentManager from "@/pages/admin/AdminContentManager";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminSettings from "@/pages/admin/AdminSettings";
import RequireAuth from "@/components/layout/RequireAuth";
import AdminLayout from "@/components/layout/AdminLayout";
import { PLANS, USER_ROLES } from "@/types/user";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/leccion" element={<LessonViewer />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Signup />} />

      {/* Estudiantes (cualquier plan logueado) */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
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
        <Route index element={<Navigate to="/admin/upload" replace />} />
        <Route path="upload" element={<AdminVideoUpload />} />
        <Route path="metrics" element={<AdminMetrics />} />
        <Route path="content" element={<AdminContentManager />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
