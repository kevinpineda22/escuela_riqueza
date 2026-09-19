import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, Search, Filter, MoreVertical, Shield, Crown, Mail,
  ShieldAlert, Trash2, Edit, X, Loader2
} from "lucide-react";
import { 
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { fetchAdminUsers, updateUserStatus, updateUserPlan, fetchUserSubscription, deleteUser, type AdminUser } from "@/lib/api/admin/users";

type Plan = "free" | "individual" | "vip";
type Role = "admin" | "student";

const planColors: Record<Plan, string> = {
  free: "bg-ink/10 text-fg-70 border border-ink/20",
  individual: "bg-blue-500/10 text-blue-400 border border-blue-500/20 light:bg-info-surface light:text-info light:border-info-line",
  vip: "bg-brand/15 text-accent border border-brand/30 shadow-[0_0_10px_rgba(204,164,59,0.1)]",
};

const roleColors: Record<Role, string> = {
  admin: "bg-red-500/10 text-danger border border-red-500/20",
  student: "bg-green-500/10 text-green-400 light:text-success border border-green-500/20",
};

const AdminUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<Plan | "all">("all");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [userSubscriptions, setUserSubscriptions] = useState<Record<string, { plan: string; endDate: string }>>({});

  // Modal para cambiar plan
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [newPlan, setNewPlan] = useState<Plan>("free");

  // Cargar datos reales
  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminUsers();
      setUsers(data);
      // Cargar suscripciones en paralelo
      const subMap: Record<string, { plan: string; endDate: string }> = {};
      await Promise.all(
        data.map(async (u) => {
          const sub = await fetchUserSubscription(u.id);
          if (sub) {
            subMap[u.id] = { plan: sub.plan, endDate: sub.current_period_end || "" };
          }
        })
      );
      setUserSubscriptions(subMap);
    } catch (err) {
      console.error("Error cargando usuarios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
        const matchesSearch = 
          u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          (u.email || "").toLowerCase().includes(searchTerm.toLowerCase());
      const userPlan = userSubscriptions[u.id]?.plan || u.plan;
      const matchesPlan = planFilter === "all" || userPlan === planFilter;
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesPlan && matchesRole;
    });
  }, [users, searchTerm, planFilter, roleFilter, userSubscriptions]);

  const getPlan = (u: AdminUser): Plan => {
    return (userSubscriptions[u.id]?.plan || u.plan) as Plan;
  };

  const handleToggleSuspend = async (u: AdminUser) => {
    const isSuspending = u.status === "active";
    const msg = isSuspending 
      ? `¿Suspender a ${u.full_name}? Perderá acceso a contenido premium.`
      : `¿Reactivar a ${u.full_name}? Restaurará su acceso.`;
    if (!window.confirm(msg)) return;
    try {
      const updated = await updateUserStatus(u.id, isSuspending);
      setUsers(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch (err) {
      console.error(err);
      alert("Error actualizando estado");
    }
  };

  const handleChangePlan = async () => {
    if (!selectedUser) return;
    try {
      await updateUserPlan(selectedUser.id, newPlan);
      await loadUsers(); // Recargar para traer la sub actualizada
      setShowPlanModal(false);
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
      alert("Error cambiando plan");
    }
  };

  const handleDelete = async (u: AdminUser) => {
    if (!window.confirm(`¿Eliminar permanentemente a ${u.full_name}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteUser(u.id);
      setUsers(prev => prev.filter(p => p.id !== u.id));
    } catch (err) {
      console.error(err);
      alert("Error eliminando usuario");
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground-strong tracking-tight flex items-center gap-3">
            <Users className="text-accent" /> Gestión de Usuarios
          </h1>
          <p className="text-foreground-muted mt-1">Visualiza y administra todos los alumnos registrados en la plataforma.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-40" size={18} />
          <input type="text" placeholder="Buscar por nombre o correo..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border border-line-subtle rounded-xl pl-11 pr-4 py-3 text-foreground-strong focus:outline-none focus:border-brand/50 transition-colors light:bg-surface-input light:border-line-control/50 light:placeholder:text-foreground-placeholder" />
        </div>
        <div className="grid grid-cols-2 md:flex md:items-center gap-2 md:gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center justify-center md:justify-start gap-2 px-3 sm:px-4 py-3 bg-black/40 border border-line-subtle rounded-xl text-fg-80 hover:text-foreground-strong transition-colors focus:outline-none light:bg-surface-input light:border-line-control/50 light:placeholder:text-foreground-placeholder">
              <Crown size={16} className="shrink-0" />
              <span className="text-xs sm:text-sm font-medium capitalize truncate">Plan: {planFilter === "all" ? "Todos" : planFilter}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filtrar por Plan</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setPlanFilter("all")}>Todos los planes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPlanFilter("free")}>Free</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPlanFilter("individual")}>Individual</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPlanFilter("vip")}>VIP</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center justify-center md:justify-start gap-2 px-3 sm:px-4 py-3 bg-black/40 border border-line-subtle rounded-xl text-fg-80 hover:text-foreground-strong transition-colors focus:outline-none light:bg-surface-input light:border-line-control/50 light:placeholder:text-foreground-placeholder">
              <Shield size={16} className="shrink-0" />
              <span className="text-xs sm:text-sm font-medium capitalize truncate">Rol: {roleFilter === "all" ? "Todos" : roleFilter}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filtrar por Rol</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setRoleFilter("all")}>Todos los roles</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRoleFilter("student")}>Estudiantes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRoleFilter("admin")}>Administradores</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="bg-black/30 border border-line-subtle rounded-2xl overflow-hidden light:bg-surface-panel light:shadow-panel">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="text-accent animate-spin" size={36} />
          </div>
        ) : (
        <>
        {/* Cards (mobile) */}
        <div className="md:hidden divide-y divide-ink/5">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((u) => {
              const plan = getPlan(u);
              const subInfo = userSubscriptions[u.id];
              return (
                <div key={u.id} className="p-4 space-y-3 hover:bg-ink/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                        {getInitials(u.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground-strong font-semibold text-sm truncate">{u.full_name}</div>
                        <div className="text-foreground-muted text-xs flex items-center gap-1 mt-0.5 truncate"><Mail size={10} className="shrink-0" /> <span className="truncate">{u.email || "Sin email"}</span></div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-2 rounded-lg text-fg-50 hover:text-foreground-strong hover:bg-ink/10 transition-colors focus:outline-none shrink-0">
                        <MoreVertical size={18} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem asChild className="flex items-center gap-2 cursor-pointer">
                          <Link to={`/admin/users/${u.id}`}>
                            <Edit size={16} /> Ver Detalles
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => { setSelectedUser(u); setNewPlan(plan); setShowPlanModal(true); }}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Crown size={16} /> Modificar Plan
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {u.status === "active" ? (
                          <DropdownMenuItem onClick={() => handleToggleSuspend(u)} className="flex items-center gap-2 cursor-pointer text-danger focus:text-red-300 focus:bg-red-500/10">
                            <ShieldAlert size={16} /> Suspender Usuario
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleToggleSuspend(u)} className="flex items-center gap-2 cursor-pointer text-green-400 light:text-success focus:text-green-300 focus:bg-green-500/10">
                            <Shield size={16} /> Reactivar Usuario
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDelete(u)} className="flex items-center gap-2 cursor-pointer text-danger focus:text-red-300 focus:bg-red-500/10">
                          <Trash2 size={16} /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className={cn("px-2 py-0.5 rounded-md font-bold uppercase tracking-wider", planColors[plan])}>{plan}</span>
                    <span className={cn("px-2 py-0.5 rounded-md font-bold uppercase tracking-wider", roleColors[u.role as Role])}>{u.role}</span>
                    <span className={cn("px-2 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1.5",
                      u.status === "active" ? "bg-green-500/10 text-green-400 light:text-success border border-green-500/20" : "bg-red-500/10 text-danger border border-red-500/20"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", u.status === "active" ? "bg-green-500" : "bg-red-500")} />
                      {u.status === "active" ? "Activo" : "Suspendido"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-foreground-muted pt-1 border-t border-ink/5">
                    <span>Registrado: <span className="text-fg-70 font-medium">{formatDate(u.created_at)}</span></span>
                    {subInfo && <span>Hasta: <span className="text-fg-70 font-medium">{formatDate(subInfo.endDate)}</span></span>}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-6 py-12 text-center text-foreground-muted">
              <Filter className="mx-auto mb-3 opacity-20" size={32} />
              <p className="text-lg font-medium text-fg-70">No se encontraron usuarios</p>
              <p className="text-sm mt-1">Prueba con otros términos de búsqueda o cambia los filtros.</p>
            </div>
          )}
        </div>

        {/* Tabla (desktop md+) */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ink/5 border-b border-line-subtle text-xs uppercase tracking-wider text-foreground-muted font-bold">
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4 hidden md:table-cell">Registrado</th>
                <th className="px-6 py-4 hidden lg:table-cell">Suscripción hasta</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const plan = getPlan(u);
                  const subInfo = userSubscriptions[u.id];
                  return (
                    <tr key={u.id} className="hover:bg-ink/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                            {getInitials(u.full_name)}
                          </div>
                          <div>
                            <div className="text-foreground-strong font-semibold text-sm">{u.full_name}</div>
                            <div className="text-foreground-muted text-xs flex items-center gap-1 mt-0.5"><Mail size={10} /> {u.email || "Sin email"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider", planColors[plan])}>{plan}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider", roleColors[u.role as Role])}>{u.role}</span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-foreground-muted text-sm">{formatDate(u.created_at)}</td>
                      <td className="px-6 py-4 hidden lg:table-cell text-foreground-muted text-sm">
                        {subInfo ? formatDate(subInfo.endDate) : <span className="text-fg-30">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className={cn("w-2 h-2 rounded-full", u.status === "active" ? "bg-green-500" : "bg-red-500")} />
                          <span className={u.status === "active" ? "text-fg-80" : "text-fg-40"}>{u.status === "active" ? "Activo" : "Suspendido"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-2 rounded-lg text-fg-50 hover:text-foreground-strong hover:bg-ink/10 transition-colors focus:outline-none">
                            <MoreVertical size={18} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem asChild className="flex items-center gap-2 cursor-pointer">
                              <Link to={`/admin/users/${u.id}`}>
                                <Edit size={16} /> Ver Detalles
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => { setSelectedUser(u); setNewPlan(plan); setShowPlanModal(true); }}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Crown size={16} /> Modificar Plan
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.status === "active" ? (
                              <DropdownMenuItem onClick={() => handleToggleSuspend(u)} className="flex items-center gap-2 cursor-pointer text-danger focus:text-red-300 focus:bg-red-500/10">
                                <ShieldAlert size={16} /> Suspender Usuario
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleToggleSuspend(u)} className="flex items-center gap-2 cursor-pointer text-green-400 light:text-success focus:text-green-300 focus:bg-green-500/10">
                                <Shield size={16} /> Reactivar Usuario
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDelete(u)} className="flex items-center gap-2 cursor-pointer text-danger focus:text-red-300 focus:bg-red-500/10">
                              <Trash2 size={16} /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-foreground-muted">
                    <Filter className="mx-auto mb-3 opacity-20" size={32} />
                    <p className="text-lg font-medium text-fg-70">No se encontraron usuarios</p>
                    <p className="text-sm mt-1">Prueba con otros términos de búsqueda o cambia los filtros.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-ink/5 border-t border-line-subtle px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-foreground-muted">Mostrando <span className="font-bold text-foreground-strong">{filteredUsers.length}</span> usuarios</div>
        </div>
        </>
        )}
      </div>

      {/* Modal para cambiar plan */}
      <AnimatePresence>
      {showPlanModal && selectedUser && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 light:bg-scrim backdrop-blur-sm"
          onClick={() => setShowPlanModal(false)}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="bg-surface-page border border-line-subtle rounded-2xl p-6 max-w-sm w-full shadow-2xl light:bg-surface-panel light:shadow-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground-strong flex items-center gap-2"><Crown className="text-accent" size={20} /> Cambiar Plan</h3>
              <button onClick={() => setShowPlanModal(false)} className="text-fg-40 hover:text-foreground-strong"><X size={20} /></button>
            </div>
            <p className="text-foreground-muted text-sm mb-4">Usuario: <span className="text-foreground-strong font-semibold">{selectedUser.full_name}</span></p>
            <div className="space-y-3">
              {(["free", "individual", "vip"] as Plan[]).map((p) => (
                <label key={p} className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                  newPlan === p ? "border-accent bg-brand/10" : "border-line-subtle bg-black/30 hover:border-ink/30 light:bg-surface-panel"
                )}>
                  <input type="radio" name="plan" value={p} checked={newPlan === p} onChange={() => setNewPlan(p)} className="accent-gold" />
                  <div>
                    <p className="text-foreground-strong font-bold capitalize">{p}</p>
                    {p === "free" && <p className="text-foreground-muted text-xs">Acceso básico, publicidad incluida</p>}
                    {p === "individual" && <p className="text-foreground-muted text-xs">Catálogo completo sin publicidad</p>}
                    {p === "vip" && <p className="text-foreground-muted text-xs">Todo el contenido + lives exclusivos</p>}
                  </div>
                </label>
              ))}
            </div>
            <button 
              onClick={handleChangePlan}
              className="w-full mt-5 bg-brand hover:bg-brand-hover text-on-brand font-bold py-2.5 rounded-xl transition-colors"
            >
              Guardar Cambios
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminUsers;