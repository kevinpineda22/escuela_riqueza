import { MailWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeEmailProblem, type EmailOutcome } from "@/lib/emailDelivery";

/** Aviso corto de la lista: el correo actual de esta persona no está recibiendo. */
export function EmailProblemBadge({ outcome }: { outcome: EmailOutcome }) {
  const problem = describeEmailProblem(outcome);
  if (!problem) return null;

  return (
    <span
      title={problem.action}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
        problem.temporary
          ? "bg-amber-500/10 text-amber-400 border-amber-500/20 light:text-amber-700"
          : "bg-red-500/10 text-danger border-red-500/20",
      )}
    >
      <MailWarning size={11} className="shrink-0" /> {problem.title}
    </span>
  );
}
