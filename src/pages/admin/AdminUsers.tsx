import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  Shield, 
  Crown, 
  Mail,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Trash2,
  Edit
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// --- Mock Data ---
type Plan = "free" | "individual" | "vip";
type Role = "admin" | "student";

interface MockUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  plan: Plan;
  role: Role;
  joinedAt: string;
  status: "active" | "suspended";
}

const mockUsers: MockUser[] = [
  { id: "1", name: "Iván Mazo", email: "ivan@escuelariqueza.com", avatar: "IM", plan: "vip", role: "admin", joinedAt: "2024-01-10", status: "active" },
  { id: "2", name: "Carlos Rendón", email: "carlos.r@gmail.com", avatar: "CR", plan: "vip", role: "student", joinedAt: "2024-02-15", status: "active" },
  { id: "3", name: "María Fernanda", email: "mafe_22@hotmail.com", avatar: "MF", plan: "individual", role: "student", joinedAt: "2024-03-01", status: "active" },
  { id: "4", name: "Luis Jiménez", email: "luis.jim@empresa.co", avatar: "LJ", plan: "free", role: "student", joinedAt: "2024-04-12", status: "suspended" },
  { id: "5", name: "Ana Victoria", email: "anavictoria.v@yahoo.com", avatar: "AV", plan: "individual", role: "student", joinedAt: "2024-04-20", status: "active" },
  { id: "6", name: "Diego Torres", email: "diego.t199@gmail.com", avatar: "DT", plan: "free", role: "student", joinedAt: "2024-05-02", status: "active" },
  { id: "7", name: "Camila Ortiz", email: "cami_ortiz@outlook.com", avatar: "CO", plan: "vip", role: "student", joinedAt: "2024-05-05", status: "active" },
];

const planColors: Record<Plan, string> = {
  free: "bg-white/10 text-white/70 border border-white/20",
  individual: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  vip: "bg-gold/15 text-gold border border-gold/30 shadow-[0_0_10px_rgba(204,164,59,0.1)]",
};

const roleColors: Record<Role, string> = {
  admin: "bg-red-500/10 text-red-400 border border-red-500/20",
  student: "bg-green-500/10 text-green-400 border border-green-500/20",
};

// --- Component ---
const AdminUsers = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<Plan | "all">("all");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");

  const filteredUsers = useMemo(() => {
    return mockUsers.filter((u) => {
      const matchesSearch = 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlan = planFilter === "all" || u.plan === planFilter;
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesPlan && matchesRole;
    });
  }, [searchTerm, planFilter, roleFilter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="text-gold" /> Gestión de Usuarios
          </h1>
          <p className="text-textMuted mt-1">
            Visualiza y administra todos los alumnos registrados en la plataforma.
          </p>
        </div>
        <button className="px-5 py-2.5 bg-gold hover:bg-goldHover text-darker font-bold rounded-xl transition-all shadow-[0_4px_14px_rgba(204,164,59,0.4)]">
          Exportar CSV
        </button>
      </div>

      {/* Toolbar (Search & Filters) */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-gold/50 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white/80 hover:text-white transition-colors focus:outline-none">
              <Crown size={16} />
              <span className="text-sm font-medium capitalize">
                Plan: {planFilter === "all" ? "Todos" : planFilter}
              </span>
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
            <DropdownMenuTrigger className="flex items-center gap-2 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white/80 hover:text-white transition-colors focus:outline-none">
              <Shield size={16} />
              <span className="text-sm font-medium capitalize">
                Rol: {roleFilter === "all" ? "Todos" : roleFilter}
              </span>
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
      <div className="bg-black/30 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-textMuted font-bold">
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4 hidden md:table-cell">Registrado</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold font-bold text-sm shrink-0">
                          {user.avatar}
                        </div>
                        <div>
                          <div className="text-white font-semibold text-sm">{user.name}</div>
                          <div className="text-textMuted text-xs flex items-center gap-1 mt-0.5">
                            <Mail size={10} /> {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider", planColors[user.plan])}>
                        {user.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider", roleColors[user.role])}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell text-textMuted text-sm">
                      {new Date(user.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className={cn("w-2 h-2 rounded-full", user.status === "active" ? "bg-green-500" : "bg-red-500")} />
                        <span className={user.status === "active" ? "text-white/80" : "text-white/40"}>
                          {user.status === "active" ? "Activo" : "Suspendido"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors focus:outline-none">
                          <MoreVertical size={18} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                            <Edit size={16} /> Ver Detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                            <Crown size={16} /> Modificar Plan
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.status === "active" ? (
                            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10">
                              <ShieldAlert size={16} /> Suspender Usuario
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-green-400 focus:text-green-300 focus:bg-green-500/10">
                              <Shield size={16} /> Reactivar Usuario
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10">
                            <Trash2 size={16} /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-textMuted">
                    <Filter className="mx-auto mb-3 opacity-20" size={32} />
                    <p className="text-lg font-medium text-white/70">No se encontraron usuarios</p>
                    <p className="text-sm mt-1">Prueba con otros términos de búsqueda o cambia los filtros.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-white/5 border-t border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-textMuted">
            Mostrando <span className="font-bold text-white">{filteredUsers.length}</span> usuarios
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors" disabled>
              <ChevronLeft size={18} />
            </button>
            <button className="px-3 py-1 rounded-lg border border-gold/30 bg-gold/10 text-gold text-sm font-bold">
              1
            </button>
            <button className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminUsers;
