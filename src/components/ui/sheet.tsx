import type { ComponentProps, ReactNode, Ref } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

function SheetOverlay({
  className,
  ref,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay> & { ref?: Ref<HTMLDivElement> }) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-darker/80 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
}

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-darker/95 backdrop-blur-xl border-white/10 p-6 shadow-2xl transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

interface SheetContentProps
  extends ComponentProps<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  ref?: Ref<HTMLDivElement>;
}

function SheetContent({ side = "right", className, children, ref, ...props }: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        <SheetClose className="absolute right-5 top-5 rounded-full p-1 text-textMuted opacity-70 transition-opacity hover:opacity-100 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-gold disabled:pointer-events-none">
          <X className="h-5 w-5" />
          <span className="sr-only">Cerrar</span>
        </SheetClose>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: { className?: string; children?: ReactNode }) {
  return <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />;
}

function SheetFooter({ className, ...props }: { className?: string; children?: ReactNode }) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ref,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title> & { ref?: Ref<HTMLHeadingElement> }) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-xl font-bold text-white", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ref,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description> & { ref?: Ref<HTMLParagraphElement> }) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm text-textMuted", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
