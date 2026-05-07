import { motion } from "motion/react";
import { LayoutDashboard, Rocket } from "lucide-react";

const AdminMetrics = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col items-center justify-center text-center p-6"
    >
      <div className="w-24 h-24 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-6 shadow-[0_0_30px_rgba(204,164,59,0.15)]">
        <LayoutDashboard size={40} />
      </div>
      <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">Métricas y Analíticas</h1>
      <p className="text-textMuted text-lg max-w-md mb-8">
        Visualiza el rendimiento de tus lecciones, retención de estudiantes y ventas en tiempo real.
      </p>
      <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-full text-gold font-bold uppercase tracking-widest text-sm">
        <Rocket size={18} /> Próximamente
      </div>
    </motion.div>
  );
};

export default AdminMetrics;
