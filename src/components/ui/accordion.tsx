import type { ComponentProps, Ref } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitive.Root;

function AccordionItem({
  className,
  ref,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item> & { ref?: Ref<HTMLDivElement> }) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn("border-b border-white/10 last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ref,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger> & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          "flex flex-1 items-center justify-between py-5 text-left text-base font-medium text-white transition-all hover:text-gold [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-5 w-5 shrink-0 text-gold transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ref,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content> & { ref?: Ref<HTMLDivElement> }) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className="overflow-hidden text-sm text-textMuted data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("pb-5 pt-0 leading-relaxed", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
