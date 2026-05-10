import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SkeletonVariant = "rect" | "circle" | "text";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

const variantClasses: Record<SkeletonVariant, string> = {
  rect: "rounded-xl",
  circle: "rounded-full aspect-square",
  text: "rounded-md h-4",
};

const Skeleton = ({ variant = "rect", className, ...rest }: SkeletonProps) => (
  <div
    aria-hidden
    className={cn(
      "relative overflow-hidden bg-white/[0.04] border border-white/[0.06]",
      variantClasses[variant],
      className,
    )}
    {...rest}
  >
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
  </div>
);

interface SkeletonGroupProps extends HTMLAttributes<HTMLDivElement> {
  count?: number;
}

const SkeletonText = ({ count = 3, className, ...rest }: SkeletonGroupProps) => (
  <div className={cn("flex flex-col gap-2", className)} {...rest}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        className={i === count - 1 ? "w-2/3" : "w-full"}
      />
    ))}
  </div>
);

const SkeletonCard = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-4",
      className,
    )}
    {...rest}
  >
    <Skeleton variant="rect" className="h-32 w-full" />
    <SkeletonText count={2} />
    <div className="flex items-center justify-between mt-1">
      <Skeleton variant="text" className="w-1/3" />
      <Skeleton variant="circle" className="w-8 h-8" />
    </div>
  </div>
);

export { Skeleton, SkeletonText, SkeletonCard };
