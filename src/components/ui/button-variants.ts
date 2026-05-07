import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-darker disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-gold text-darker hover:bg-goldHover shadow-[0_0_15px_rgba(204,164,59,0.3)] hover:shadow-[0_0_25px_rgba(204,164,59,0.5)]",
        secondary: "bg-white/5 text-white hover:bg-white/10 border border-white/10 backdrop-blur-md",
        outline: "border border-gold/40 text-gold hover:bg-gold/10 hover:border-gold",
        ghost: "text-textMuted hover:text-white hover:bg-white/5",
        link: "text-gold underline-offset-4 hover:underline",
        destructive: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        md: "h-11 px-6",
        lg: "h-14 px-8 text-base rounded-2xl",
        xl: "h-16 px-10 text-lg rounded-2xl",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);
