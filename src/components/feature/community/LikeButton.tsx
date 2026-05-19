import { Heart } from "lucide-react";
import { useState } from "react";
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

  // Keep in sync if parent updates (e.g. realtime)
  if (liked !== optimisticLiked && !loading) setOptimisticLiked(liked);
  if (count !== optimisticCount && !loading) setOptimisticCount(count);

  const handleClick = async () => {
    if (loading) return;
    const newLiked = !optimisticLiked;
    const newCount = Math.max(0, optimisticCount + (newLiked ? 1 : -1));
    setOptimisticLiked(newLiked);
    setOptimisticCount(newCount);
    setLoading(true);
    try {
      const result = await toggleLike(targetType, targetId);
      setOptimisticLiked(result);
      onChange?.(result, newCount);
    } catch (err) {
      console.error(err);
      setOptimisticLiked(!newLiked);
      setOptimisticCount(count);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? 14 : 16;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg transition-colors disabled:opacity-50",
        size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm",
        optimisticLiked
          ? "bg-gold/15 text-gold"
          : "bg-white/5 text-textMuted hover:bg-white/10 hover:text-white"
      )}
      aria-pressed={optimisticLiked}
    >
      <Heart size={iconSize} className={optimisticLiked ? "fill-gold" : ""} />
      <span className="font-semibold tabular-nums">{optimisticCount}</span>
    </button>
  );
}
