import { motion, AnimatePresence } from "motion/react";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { toggleLike, type LikeTarget } from "@/lib/api/community";

interface LikeButtonProps {
  targetType: LikeTarget;
  targetId: string;
  liked: boolean;
  count: number;
  size?: "sm" | "md";
  onChange?: (liked: boolean, newCount: number) => void;
}

export function LikeButton({ targetType, targetId, liked, count, size = "md", onChange }: LikeButtonProps) {
  const [optimisticLiked, setOptimisticLiked] = useState(liked);
  const [optimisticCount, setOptimisticCount] = useState(count);
  const [loading, setLoading] = useState(false);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    setOptimisticLiked(liked);
  }, [liked]);

  useEffect(() => {
    setOptimisticCount(count);
  }, [count]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    const newLiked = !optimisticLiked;
    const newCount = Math.max(0, optimisticCount + (newLiked ? 1 : -1));
    setOptimisticLiked(newLiked);
    setOptimisticCount(newCount);
    if (newLiked) setBurst((b) => b + 1);
    setLoading(true);
    try {
      const result = await toggleLike(targetType, targetId);
      // Wait for real-time trigger to update DB, but we already have optimistic state
      setOptimisticLiked(result);
      onChange?.(result, newCount);
    } catch (err) {
      console.error(err);
      // Revert on error
      setOptimisticLiked(!newLiked);
      setOptimisticCount(count);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? 14 : 16;

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={loading}
      whileTap={{ scale: 0.92 }}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full transition-all duration-300 disabled:opacity-50 overflow-visible",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        optimisticLiked
          ? "bg-gradient-to-r from-gold/20 to-gold/10 text-gold ring-1 ring-gold/40 shadow-[0_0_12px_rgba(204,164,59,0.25)]"
          : "bg-white/[0.04] text-textMuted hover:bg-white/10 hover:text-white ring-1 ring-white/5 hover:ring-white/10"
      )}
      aria-pressed={optimisticLiked}
    >
      <motion.span
        key={`${optimisticLiked}-${burst}`}
        initial={optimisticLiked ? { scale: 0.5 } : { scale: 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 14 }}
        className="relative inline-flex"
      >
        <Heart size={iconSize} className={optimisticLiked ? "fill-gold" : ""} />
        <AnimatePresence>
          {optimisticLiked && (
            <motion.span
              key={burst}
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 2.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 rounded-full bg-gold/40 blur-md pointer-events-none"
            />
          )}
        </AnimatePresence>
      </motion.span>
      <motion.span
        key={optimisticCount}
        initial={{ y: -4, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="font-semibold tabular-nums"
      >
        {optimisticCount}
      </motion.span>
    </motion.button>
  );
}
