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
import { fetchDashboardMetrics, type DashboardMetrics, type MetricsPeriod } from "@/lib/api/admin/metrics";
import { toast } from "@/components/ui/toaster";
import { useEffectiveTheme } from "@/hooks/useTheme";
import type { EffectiveTheme } from "@/lib/theme";

// Recharts pinta con props de SVG, no con clases: la paleta sale del tema. Solo
// cambian props (sin key temática), así que el gráfico no se recrea al alternar.
// Claro: el trazo VIP usa el oro de lectura (#846313, 5,6:1); el oro de marca
// sobre blanco (2,35:1) no alcanza el 3:1 de un elemento gráfico.
const CHART_PALETTE: Record<EffectiveTheme, {
  vipStroke: string; vipFill: string; vipFillOpacity: number;
  indStroke: string; indFill: string; indFillOpacity: number;
  grid: string; axis: string; tooltipBg: string; tooltipBorder: string; tooltipText: string;
}> = {
  dark: {
    vipStroke: "#CCA43B", vipFill: "#CCA43B", vipFillOpacity: 0.3,
    indStroke: "#A3A3A3", indFill: "#E5E5E5", indFillOpacity: 0.1,
    grid: "#ffffff10", axis: "#A3A3A3", tooltipBg: "#0a0a0a", tooltipBorder: "#ffffff20", tooltipText: "#fff",
  },
  light: {
    vipStroke: "#846313", vipFill: "#CCA43B", vipFillOpacity: 0.28,
    indStroke: "#625e56", indFill: "#625e56", indFillOpacity: 0.12,
    grid: "#1c1a1614", axis: "#625e56", tooltipBg: "#ffffff", tooltipBorder: "#ded8cc", tooltipText: "#1c1a16",
  },
};

const periods: { id: MetricsPeriod; label: string }[] = [
  { id: "7d", label: "Últimos 7 días" },
  { id: "month", label: "Este mes" },
  { id: "year", label: "Este año" },
  { id: "all", label: "Histórico" },
];

const AdminMetrics = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<MetricsPeriod>("month");
  const chart = CHART_PALETTE[useEffectiveTheme()];

  useEffect(() => {
    let cancelled = false;
    const loadMetrics = async () => {
      setIsLoading(true);
      try {
        const data = await fetchDashboardMetrics(period);
        if (!cancelled) setMetrics(data);
      } catch (error) {
        console.error("Error fetching metrics:", error);
        if (!cancelled) {
          toast.error("Error", {
            description: "No se pudieron cargar las métricas en tiempo real.",
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadMetrics();
    return () => {
      cancelled = true;
    };
  }, [period]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const periodLabel = periods.find((p) => p.id === period)?.label ?? "";
  const isAllTime = period === "all";

  // --- KPIs reales ---
  const kpiData = [
    {
      title: isAllTime ? "Usuarios Totales" : "Nuevos usuarios",
      value: (isAllTime ? metrics?.totalUsers : metrics?.newUsersInPeriod)?.toString() || "0",
      change: isAllTime ? "Histórico" : periodLabel,
      isPositive: true,
      icon: Users,
    },
    {
      title: isAllTime ? "Ingresos (MRR Estimado)" : "Ingresos del período",
      value: `$${(isAllTime ? metrics?.totalRevenue : metrics?.revenueInPeriod)?.toLocaleString() || "0"}`,
      change: isAllTime ? "Suscripciones activas" : periodLabel,
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
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground-strong tracking-tight">
            Métricas y Analíticas
          </h1>
          <p className="text-foreground-muted mt-1 text-sm sm:text-base">
            Resumen de rendimiento de Escuela de la Riqueza.
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-black/40 border border-line-subtle rounded-xl p-1 w-full sm:w-auto overflow-x-auto custom-scrollbar light:bg-surface-panel">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0",
                period === p.id
                  ? "bg-brand/15 text-accent shadow-[0_0_10px_rgba(204,164,59,0.1)]"
                  : "text-fg-60 hover:text-foreground-strong hover:bg-ink/5"
              )}
            >
              {p.label}
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
            className="bg-black/30 border border-line-subtle rounded-2xl p-6 hover:bg-ink/[0.02] light:hover:bg-surface-panel transition-colors relative overflow-hidden group light:bg-surface-panel light:shadow-panel"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-start justify-between mb-4 gap-2">
              <div className="w-12 h-12 rounded-xl bg-ink/5 border border-line-subtle flex items-center justify-center text-foreground-strong group-hover:border-brand/30 group-hover:text-accent transition-colors shrink-0">
                <kpi.icon size={24} strokeWidth={1.5} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full max-w-[60%] truncate",
                kpi.isPositive ? "bg-green-500/10 text-green-400 light:text-success" : "bg-red-500/10 text-danger"
              )}>
                {kpi.isPositive ? <ArrowUpRight size={12} className="shrink-0" /> : <ArrowDownRight size={12} className="shrink-0" />}
                <span className="truncate">{kpi.change}</span>
              </div>
            </div>
            <div>
              <h3 className="text-foreground-muted text-sm font-medium mb-1">{kpi.title}</h3>
              <p className="text-3xl font-extrabold text-foreground-strong tracking-tight">{kpi.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-black/30 border border-line-subtle rounded-2xl p-6 flex flex-col h-[400px] light:bg-surface-panel light:shadow-panel">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-foreground-strong">Ingresos por Plan (Histórico)</h3>
            <button className="text-foreground-muted hover:text-foreground-strong transition-colors">
              <Filter size={18} />
            </button>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVIP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chart.vipFill} stopOpacity={chart.vipFillOpacity}/>
                    <stop offset="95%" stopColor={chart.vipFill} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorInd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chart.indFill} stopOpacity={chart.indFillOpacity}/>
                    <stop offset="95%" stopColor={chart.indFill} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke={chart.axis} 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  stroke={chart.axis} 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `$${value}`}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: chart.tooltipBg, borderColor: chart.tooltipBorder, borderRadius: '12px' }}
                  itemStyle={{ color: chart.tooltipText }}
                  formatter={(value) => [`$${value ?? 0}`, ""]}
                />
                <Area 
                  type="monotone" 
                  dataKey="Individual" 
                  stroke={chart.indStroke} 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorInd)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="VIP" 
                  stroke={chart.vipStroke} 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorVIP)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Modules */}
        <div className="bg-black/30 border border-line-subtle rounded-2xl p-6 flex flex-col h-[400px] light:bg-surface-panel light:shadow-panel">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-foreground-strong">Lecciones más vistas</h3>
            <p className="text-xs text-foreground-muted mt-1">{periodLabel}</p>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
            {metrics?.topLessons && metrics.topLessons.length > 0 ? (
              metrics.topLessons.map((lesson, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-ink/5 border border-transparent hover:border-ink/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center text-accent font-bold border border-brand/20 shrink-0">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-foreground-strong text-sm font-medium truncate" title={lesson.title}>
                      {lesson.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-foreground-muted mt-1">
                      <span className="flex items-center gap-1">
                        <PlayCircle size={12} /> {lesson.views} vistas
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-foreground-muted">
                <PlayCircle className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">No hay datos de vistas aún</p>
              </div>
            )}
          </div>
          <button className="mt-4 w-full py-3 bg-ink/5 hover:bg-ink/10 text-foreground-strong text-sm font-medium rounded-xl transition-colors border border-line-subtle light:bg-surface-panel light:shadow-sm light:hover:bg-surface-subtle">
            Ver todas las lecciones
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminMetrics;