import { describe, it, expect } from "vitest";
import { describeEmailProblem, type EmailOutcome } from "./emailDelivery";

const outcome = (over: Partial<EmailOutcome>): EmailOutcome => ({
  status: "bounced",
  bounce_type: "Permanent",
  bounce_subtype: "General",
  detail: null,
  ...over,
});

describe("describeEmailProblem", () => {
  it("entregado, enviado o demorado no piden acción", () => {
    expect(describeEmailProblem(outcome({ status: "delivered" }))).toBeNull();
    expect(describeEmailProblem(outcome({ status: "sent" }))).toBeNull();
    expect(describeEmailProblem(outcome({ status: "delivery_delayed" }))).toBeNull();
  });

  it("reconoce un correo que no existe por el diagnóstico de Gmail", () => {
    const problem = describeEmailProblem(
      outcome({ detail: "550-5.1.1 The email account that you tried to reach does not exist." }),
    );
    expect(problem?.kind).toBe("not_found");
    expect(problem?.temporary).toBe(false);
  });

  it("reconoce la bandeja llena aunque Resend lo marque como permanente", () => {
    const problem = describeEmailProblem(
      outcome({ detail: "452-4.2.2 The recipient's inbox is out of storage space." }),
    );
    expect(problem?.kind).toBe("mailbox_full");
    expect(problem?.temporary).toBe(true);
  });

  it("reconoce el subtipo aunque no haya mensaje", () => {
    expect(describeEmailProblem(outcome({ bounce_subtype: "NoEmail" }))?.kind).toBe("not_found");
    expect(describeEmailProblem(outcome({ bounce_type: "Transient", bounce_subtype: "MailboxFull" }))?.kind).toBe("mailbox_full");
    expect(describeEmailProblem(outcome({ bounce_subtype: "Suppressed" }))?.kind).toBe("blocked");
  });

  it("un rebote cargado del historial dice que no tiene motivo", () => {
    expect(describeEmailProblem(outcome({ bounce_type: null, bounce_subtype: null }))?.kind).toBe("unknown_reason");
  });

  it("sin motivo, el bloqueo de Resend dice si es permanente o pasajero", () => {
    const sinMotivo = outcome({ bounce_type: null, bounce_subtype: null });
    expect(describeEmailProblem(sinMotivo, true)?.kind).toBe("blocked");
    expect(describeEmailProblem(sinMotivo, false)?.kind).toBe("bounced_not_blocked");
    expect(describeEmailProblem(sinMotivo, false)?.temporary).toBe(true);
    expect(describeEmailProblem(sinMotivo, null)?.kind).toBe("unknown_reason");
  });

  it("con motivo, el bloqueo no lo pisa", () => {
    const noExiste = outcome({ detail: "550 5.1.1 does not exist" });
    expect(describeEmailProblem(noExiste, false)?.kind).toBe("not_found");
  });

  it("un rebote con motivo desconocido no se inventa una causa", () => {
    expect(describeEmailProblem(outcome({ detail: "554 policy rejection" }))?.kind).toBe("bounced");
  });
});
