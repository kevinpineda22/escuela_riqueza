import { Toaster as SonnerToaster } from "sonner";

const Toaster = () => (
  <SonnerToaster
    position="top-right"
    theme="dark"
    richColors={false}
    closeButton
    visibleToasts={4}
    gap={10}
    toastOptions={{
      duration: 4500,
      classNames: {
        toast:
          "group !bg-darker/95 !border !border-white/10 !backdrop-blur-xl !text-textMain !rounded-2xl !shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] !font-sans",
        title: "!text-white !font-semibold !text-sm",
        description: "!text-textMuted !text-xs !leading-relaxed",
        actionButton:
          "!bg-gold !text-darker !font-bold !rounded-full !px-3 !py-1.5 !text-xs hover:!bg-goldHover",
        cancelButton:
          "!bg-white/5 !text-white/70 !rounded-full !px-3 !py-1.5 !text-xs hover:!text-white",
        closeButton:
          "!bg-darker !border !border-white/10 !text-white/60 hover:!text-white",
        success: "!border-gold/30 [&_[data-icon]]:!text-gold",
        error: "!border-red-500/30 [&_[data-icon]]:!text-red-400",
        info: "!border-sky-500/30 [&_[data-icon]]:!text-sky-400",
        warning: "!border-amber-500/30 [&_[data-icon]]:!text-amber-400",
      },
    }}
  />
);

export { Toaster };
export { toast } from "sonner";
