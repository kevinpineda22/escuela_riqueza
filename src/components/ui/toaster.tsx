import { Toaster as SonnerToaster } from "sonner";
import { useEffectiveTheme } from "@/hooks/useTheme";

const Toaster = () => {
  const theme = useEffectiveTheme();

  return (
    <SonnerToaster
      position="top-right"
      theme={theme}
      richColors={false}
      closeButton
      visibleToasts={4}
      gap={10}
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            "group !bg-surface-popover !border !border-line-subtle !backdrop-blur-xl !text-foreground !rounded-2xl !shadow-panel !font-sans",
          title: "!text-foreground-strong !font-semibold !text-sm",
          description: "!text-foreground-muted !text-xs !leading-relaxed",
          actionButton:
            "!bg-brand !text-on-brand !font-bold !rounded-full !px-3 !py-1.5 !text-xs hover:!bg-brand-hover",
          cancelButton:
            "!bg-surface-subtle !text-foreground-strong/70 !rounded-full !px-3 !py-1.5 !text-xs hover:!text-foreground-strong",
          closeButton:
            "!bg-surface-page !border !border-line-subtle !text-foreground-strong/60 hover:!text-foreground-strong",
          success: "!border-brand/30 [&_[data-icon]]:!text-accent",
          error: "!border-danger-line [&_[data-icon]]:!text-danger",
          info: "!border-info-line [&_[data-icon]]:!text-info",
          warning: "!border-warning-line [&_[data-icon]]:!text-warning",
        },
      }}
    />
  );
};

export { Toaster };
export { toast } from "sonner";
