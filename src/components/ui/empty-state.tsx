import type { ReactNode, ComponentType } from "react";
import { motion } from "motion/react";
import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ComponentType<LucideProps>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, ease: "easeOut" }}
    className={cn(
      "flex flex-col items-center justify-center text-center gap-4 px-6 py-12 rounded-3xl",
      "bg-white/[0.02] border border-white/[0.06]",
      className,
    )}
  >
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-0 rounded-full bg-gold/20 blur-2xl scale-150"
      />
      <motion.div
        className="relative w-20 h-20 rounded-full bg-gradient-to-br from-gold/15 to-amber-500/10 border border-gold/20 flex items-center justify-center"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className="text-gold" size={32} strokeWidth={1.6} />
      </motion.div>
    </div>

    <div className="flex flex-col gap-1.5 max-w-md">
      <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-textMuted leading-relaxed">{description}</p>
      )}
    </div>

    {action && <div className="mt-2">{action}</div>}
  </motion.div>
);

export { EmptyState };
