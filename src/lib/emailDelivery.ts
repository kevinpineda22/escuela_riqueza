/** Traduce lo que reporta Resend a lo que un admin de la escuela puede resolver. */

export type EmailStatus =
  | "sent"
  | "delivery_delayed"
  | "delivered"
  | "failed"
  | "suppressed"
  | "bounced"
  | "complained";

export const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  sent: "Enviado",
  delivery_delayed: "Demorado",
  delivered: "Entregado",
  failed: "Falló",
  suppressed: "Bloqueado",
  bounced: "Rebotó",
  complained: "Marcado como spam",
};

export interface EmailOutcome {
  status: EmailStatus;
  bounce_type: string | null;
  bounce_subtype: string | null;
  detail: string | null;
}

export type EmailProblemKind =
  | "not_found"
  | "mailbox_full"
  | "blocked"
  | "spam"
  | "failed"
  | "bounced"
  | "unknown_reason";

export interface EmailProblem {
  kind: EmailProblemKind;
  title: string;
  action: string;
  /** Temporal: el correo sirve y puede llegar más adelante. */
  temporary: boolean;
}

const MAILBOX_FULL = /mailbox ?full|inbox is full|over ?quota|quota exceeded|out of storage|storage space|insufficient storage/i;
const NOT_FOUND = /noemail|does ?n[o']t exist|no such user|user unknown|unknown user|recipient not found|address not found|nosuchuser|account .*disabled/i;
const BLOCKED = /suppress/i;

const PROBLEMS: Record<EmailProblemKind, Omit<EmailProblem, "kind">> = {
  not_found: {
    title: "El correo no existe",
    action: "Pídele a la persona su correo correcto y corrígelo en su ficha.",
    temporary: false,
  },
  mailbox_full: {
    title: "Bandeja llena",
    action: "El correo es correcto. Pídele que libere espacio y reenvía el acceso.",
    temporary: true,
  },
  blocked: {
    title: "Correo bloqueado",
    action: "No se le envía nada a esta dirección por un rebote anterior. Si el correo es correcto, quita el bloqueo.",
    temporary: false,
  },
  spam: {
    title: "Marcó el correo como spam",
    action: "Pregúntale si quiere seguir recibiendo correos antes de reenviarle algo.",
    temporary: false,
  },
  failed: {
    title: "No se pudo enviar",
    action: "Intenta reenviar el acceso. Si vuelve a fallar, avísale al equipo técnico.",
    temporary: true,
  },
  bounced: {
    title: "El correo rechazó el mensaje",
    action: "Confirma con la persona que el correo esté bien escrito.",
    temporary: false,
  },
  unknown_reason: {
    title: "El correo rebotó",
    action: "Este envío no tiene motivo registrado. Confirma con la persona que el correo esté bien escrito.",
    temporary: false,
  },
};

/** `null` si el correo no tiene ningún problema que atender. */
export function describeEmailProblem(outcome: EmailOutcome): EmailProblem | null {
  const problem = (kind: EmailProblemKind): EmailProblem => ({ kind, ...PROBLEMS[kind] });

  switch (outcome.status) {
    case "complained":
      return problem("spam");
    case "failed":
      return problem("failed");
    case "suppressed":
      return problem("blocked");
    case "bounced": {
      const text = [outcome.bounce_subtype, outcome.detail].filter(Boolean).join(" ");
      // Bandeja llena antes que "no existe": es el único caso que se arregla solo.
      if (MAILBOX_FULL.test(text)) return problem("mailbox_full");
      if (NOT_FOUND.test(text)) return problem("not_found");
      if (outcome.bounce_subtype && BLOCKED.test(outcome.bounce_subtype)) return problem("blocked");
      if (!outcome.bounce_type && !outcome.detail) return problem("unknown_reason");
      return problem("bounced");
    }
    default:
      return null;
  }
}
