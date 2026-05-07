import { Routes, Route } from "react-router-dom";
import LandingPage from "@/pages/public/LandingPage";
import Login from "@/pages/public/Login";
import LessonViewer from "@/pages/student/LessonViewer";
import Dashboard from "@/pages/student/Dashboard";
import VIPLiveRoom from "@/pages/student/VIPLiveRoom";
import AdminVideoUpload from "@/pages/admin/AdminVideoUpload";
import RequireAuth from "@/components/layout/RequireAuth";
import { PLANS, USER_ROLES } from "@/types/user";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/leccion" element={<LessonViewer />} />
      <Route path="/login" element={<Login />} />

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

      {/* Admin */}
      <Route
        path="/admin/upload"
        element={
          <RequireAuth role={USER_ROLES.ADMIN}>
            <AdminVideoUpload />
          </RequireAuth>
        }
      />
    </Routes>
  );
};

export default AppRoutes;
