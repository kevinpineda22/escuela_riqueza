import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-on-brand hover:bg-brand-hover shadow-[0_0_15px_rgba(204,164,59,0.3)] hover:shadow-[0_0_25px_rgba(204,164,59,0.5)]",
        secondary:
          "bg-ink/5 text-foreground-strong hover:bg-ink/10 border border-line-subtle backdrop-blur-md light:bg-surface-panel light:hover:bg-surface-subtle light:shadow-sm",
        outline: "border border-brand/40 text-accent hover:bg-brand/10 hover:border-accent",
        ghost: "text-foreground-muted hover:text-foreground-strong hover:bg-ink/5",
        link: "text-accent underline-offset-4 hover:underline",
        destructive: "bg-danger-surface text-danger hover:bg-red-500/20 border border-danger-line",
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
