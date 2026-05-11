import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Users, 
  DollarSign, 
  PlayCircle, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Loader2,
  Crown
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer
} from "recharts";
import { cn } from "@/lib/utils";
import { fetchDashboardMetrics, type DashboardMetrics } from "@/lib/api/admin/metrics";
import { toast } from "@/components/ui/toaster";

const periods = ["Últimos 7 días", "Este mes", "Este año", "Histórico"];

const AdminMetrics = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState(periods[1]);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const data = await fetchDashboardMetrics();
        setMetrics(data);
      } catch (error) {
        console.error("Error fetching metrics:", error);
        toast.error("Error", {
          description: "No se pudieron cargar las métricas en tiempo real.",
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadMetrics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  // --- Real Data Formatting ---
  const kpiData = [
    {
      title: "Usuarios Totales",
      value: metrics?.totalUsers.toString() || "0",
      change: "En tiempo real",
      isPositive: true,
      icon: Users,
    },
    {
      title: "Ingresos (MRR Estimado)",
      value: `$${metrics?.totalRevenue.toLocaleString() || "0"}`,
      change: "Suscripciones activas",
      isPositive: true,
      icon: DollarSign,
    },
    {
      title: "Módulos Publicados",
      value: metrics?.publishedModules.toString() || "0",
      change: "En catálogo",
      isPositive: true,
      icon: PlayCircle,
    },
    {
      title: "Usuarios VIP",
      value: metrics?.usersByPlan.vip.toString() || "0",
      change: "Plan de mayor valor",
      isPositive: true,
      icon: Crown,
    },
  ];

  // Gráfico de relleno (Placeholder hasta conectar Stripe historicals)
  const revenueData = [
    { name: "Ene", VIP: 4000, Individual: 2400 },
    { name: "Feb", VIP: 3000, Individual: 1398 },
    { name: "Mar", VIP: 2000, Individual: 9800 },
    { name: "Abr", VIP: 2780, Individual: 3908 },
    { name: "May", VIP: 1890, Individual: 4800 },
    { name: "Jun", VIP: 2390, Individual: 3800 },
    { name: "Jul", VIP: 3490, Individual: 4300 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8"
    >
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Métricas y Analíticas
          </h1>
          <p className="text-textMuted mt-1">
            Resumen de rendimiento de Escuela de la Riqueza.
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                period === p 
                  ? "bg-gold/15 text-gold shadow-[0_0_10px_rgba(204,164,59,0.1)]" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, i) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-black/30 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.02] transition-colors relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:border-gold/30 group-hover:text-gold transition-colors">
                <kpi.icon size={24} strokeWidth={1.5} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                kpi.isPositive ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
              )}>
                {kpi.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {kpi.change}
              </div>
            </div>
            <div>
              <h3 className="text-textMuted text-sm font-medium mb-1">{kpi.title}</h3>
              <p className="text-3xl font-extrabold text-white tracking-tight">{kpi.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-black/30 border border-white/10 rounded-2xl p-6 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white">Ingresos por Plan (Histórico)</h3>
            <button className="text-textMuted hover:text-white transition-colors">
              <Filter size={18} />
            </button>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVIP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CCA43B" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#CCA43B" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorInd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E5E5E5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#E5E5E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#A3A3A3" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  stroke="#A3A3A3" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `$${value}`}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#ffffff20', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value) => [`$${value ?? 0}`, ""]}
                />
                <Area 
                  type="monotone" 
                  dataKey="Individual" 
                  stroke="#A3A3A3" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorInd)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="VIP" 
                  stroke="#CCA43B" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorVIP)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Modules */}
        <div className="bg-black/30 border border-white/10 rounded-2xl p-6 flex flex-col h-[400px]">
          <h3 className="text-lg font-bold text-white mb-6">Lecciones más vistas</h3>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
            {metrics?.topLessons && metrics.topLessons.length > 0 ? (
              metrics.topLessons.map((lesson, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center text-gold font-bold border border-gold/20 shrink-0">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-white text-sm font-medium truncate" title={lesson.title}>
                      {lesson.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-textMuted mt-1">
                      <span className="flex items-center gap-1">
                        <PlayCircle size={12} /> {lesson.views} vistas
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-textMuted">
                <PlayCircle className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">No hay datos de vistas aún</p>
              </div>
            )}
          </div>
          <button className="mt-4 w-full py-3 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors border border-white/10">
            Ver todas las lecciones
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminMetrics;