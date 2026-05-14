import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Shield,
  Crown,
  ShieldAlert,
  Trash2,
  Edit,
  Loader2,
  CheckCircle2,
  XCircle,
  CreditCard,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchAdminUsers,
  updateUserStatus,
  updateUserPlan,
  fetchUserSubscription,
  deleteUser,
  type AdminUser,
  type SubscriptionInfo,
} from "@/lib/api/admin/users";
import { toast } from "@/components/ui/toaster";
import { Skeleton } from "@/components/ui/skeleton";
import type { Plan } from "@/types/user";

const planColors: Record<Plan, string> = {
  free: "bg-white/10 text-white/70 border border-white/20",
  individual: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  vip: "bg-gold/15 text-gold border border-gold/30 shadow-[0_0_10px_rgba(204,164,59,0.1)]",
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "");
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AdminUserDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [newPlan, setNewPlan] = useState<Plan>("free");

  useEffect(() => {
    if (!id) return;
    const loadUser = async () => {
      try {
        setLoading(true);
        const all = await fetchAdminUsers();
        const found = all.find((u) => u.id === id);
        if (!found) {
          toast.error("Usuario no encontrado");
          navigate("/admin/users");
          return;
        }
        setUser(found);
        setNewPlan(found.plan);
        const sub = await fetchUserSubscription(id);
        setSubscription(sub);
      } catch (err) {
        toast.error("Error cargando usuario", { description: (err as Error).message });
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [id, navigate]);

  const handleToggleSuspend = async () => {
    if (!user) return;
    const isSuspending = user.status === "active";
    const msg = isSuspending
      ? `¿Suspender a ${user.full_name}? Perderá acceso a contenido premium.`
      : `¿Reactivar a ${user.full_name}?`;
    if (!window.confirm(msg)) return;
    try {
      setIsMutating(true);
      const updated = await updateUserStatus(user.id, isSuspending);
      setUser(updated);
      toast.success(isSuspending ? "Usuario suspendido" : "Usuario reactivado");
    } catch (err) {
      toast.error("Error actualizando estado", { description: (err as Error).message });
    } finally {
      setIsMutating(false);
    }
  };

  const handleSavePlan = async () => {
    if (!user) return;
    try {
      setIsMutating(true);
      await updateUserPlan(user.id, newPlan);
      const refreshed = await fetchAdminUsers();
      const found = refreshed.find((u) => u.id === user.id);
      if (found) setUser(found);
      const sub = await fetchUserSubscription(user.id);
      setSubscription(sub);
      setShowPlanEditor(false);
      toast.success("Plan actualizado");
    } catch (err) {
      toast.error("Error cambiando plan", { description: (err as Error).message });
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!window.confirm(`¿Eliminar permanentemente a ${user.full_name}? Esta acción no se puede deshacer.`)) return;
    try {
      setIsMutating(true);
      await deleteUser(user.id);
      toast.success("Usuario eliminado");
      navigate("/admin/users");
    } catch (err) {
      toast.error("Error eliminando usuario", { description: (err as Error).message });
      setIsMutating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-6 sm:space-y-8"
    >
      {/* Volver */}
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-textMuted hover:text-white transition-colors"
      >
        <ArrowLeft size={16} /> Volver al listado
      </Link>

      {/* Card principal */}
      <div className="relative bg-black/30 border border-white/10 rounded-3xl p-6 sm:p-8 overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 bg-gold/5 rounded-full blur-3xl -mr-20 -mt-20 hidden md:block"
        />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gold/10 border-2 border-gold/30 flex items-center justify-center text-gold text-2xl sm:text-3xl font-bold shrink-0 shadow-[0_0_25px_rgba(204,164,59,0.2)]">
            {getInitials(user.full_name).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-gold">
                Perfil de alumno
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
              {user.full_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-textMuted">
              {user.email && (
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <Mail size={14} className="shrink-0" />
                  <span className="truncate">{user.email}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} className="shrink-0" />
                Miembro desde {formatDate(user.created_at)}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={cn("px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider", planColors[user.plan])}>
                {user.plan === "vip" && <Crown size={11} className="inline mr-1" />}
                Plan {user.plan}
              </span>
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border",
                  user.role === "admin"
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-green-500/10 text-green-400 border-green-500/20"
                )}
              >
                {user.role}
              </span>
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border inline-flex items-center gap-1.5",
                  user.status === "active"
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    user.status === "active" ? "bg-green-500 animate-pulse" : "bg-red-500"
                  )}
                />
                {user.status === "active" ? "Activo" : "Suspendido"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid info + acciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Suscripción */}
        <div className="lg:col-span-2 bg-black/30 border border-white/10 rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <CreditCard size={18} className="text-gold" /> Suscripción
          </h2>
          {subscription ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-textMuted uppercase tracking-wider">Plan</p>
                <p className="text-white font-bold uppercase tracking-wide">{subscription.plan}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-textMuted uppercase tracking-wider">Estado</p>
                <p className="inline-flex items-center gap-1.5 text-white font-medium capitalize">
                  {subscription.status === "active" ? (
                    <CheckCircle2 size={14} className="text-green-400" />
                  ) : (
                    <XCircle size={14} className="text-red-400" />
                  )}
                  {subscription.status}
                </p>
              </div>
              {subscription.current_period_end && (
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs text-textMuted uppercase tracking-wider">Período actual hasta</p>
                  <p className="text-white/85 text-sm flex items-center gap-1.5">
                    <Clock size={14} className="text-gold" />
                    {formatDateTime(subscription.current_period_end)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-textMuted">
              <CreditCard className="mx-auto mb-2 opacity-30" size={28} />
              <p className="text-sm">Sin suscripción activa registrada</p>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="bg-black/30 border border-white/10 rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock size={18} className="text-gold" /> Actividad
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-textMuted uppercase tracking-wider">Creado</p>
              <p className="text-white/85">{formatDateTime(user.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-textMuted uppercase tracking-wider">Última actualización</p>
              <p className="text-white/85">{formatDateTime(user.updated_at)}</p>
            </div>
            <div>
              <p className="text-xs text-textMuted uppercase tracking-wider">ID</p>
              <p className="text-white/50 font-mono text-[11px] break-all">{user.id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="bg-black/30 border border-white/10 rounded-2xl p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Shield size={18} className="text-gold" /> Acciones administrativas
        </h2>

        {showPlanEditor ? (
          <div className="space-y-4">
            <p className="text-sm text-textMuted">Selecciona el nuevo plan:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["free", "individual", "vip"] as Plan[]).map((p) => (
                <label
                  key={p}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                    newPlan === p ? "border-gold bg-gold/10" : "border-white/10 bg-black/30 hover:border-white/30"
                  )}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={p}
                    checked={newPlan === p}
                    onChange={() => setNewPlan(p)}
                    className="accent-gold"
                  />
                  <div>
                    <p className="text-white font-bold capitalize text-sm">{p}</p>
                    <p className="text-textMuted text-[11px]">
                      {p === "free" && "Acceso básico con publicidad"}
                      {p === "individual" && "Catálogo completo sin anuncios"}
                      {p === "vip" && "Todo + lives + mentoría"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={() => setShowPlanEditor(false)}
                disabled={isMutating}
                className="px-4 py-2.5 text-sm text-white/70 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePlan}
                disabled={isMutating}
                className="px-5 py-2.5 bg-gold hover:bg-goldHover text-darker font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isMutating && <Loader2 size={14} className="animate-spin" />}
                Guardar cambios
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowPlanEditor(true)}
              disabled={isMutating}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-gold/30 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              <Edit size={16} /> Modificar plan
            </button>
            <button
              onClick={handleToggleSuspend}
              disabled={isMutating}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border disabled:opacity-50",
                user.status === "active"
                  ? "bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400"
                  : "bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-400"
              )}
            >
              {user.status === "active" ? (
                <>
                  <ShieldAlert size={16} /> Suspender
                </>
              ) : (
                <>
                  <Shield size={16} /> Reactivar
                </>
              )}
            </button>
            <button
              onClick={handleDelete}
              disabled={isMutating}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-900/30 hover:bg-red-900/50 border border-red-800/30 hover:border-red-700/50 text-red-400 hover:text-red-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ml-auto"
            >
              <Trash2 size={16} /> Eliminar
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminUserDetail;
