import { describe, it, expect } from "vitest";
import { reconcileWindowedMessages } from "./reconcileWindowedMessages";

interface Msg {
  id: string;
  created_at: string;
  message: string;
  reply_to_user_name?: string | null;
  reply_to_excerpt?: string | null;
}

const at = (minute: number) => `2026-10-09T10:${String(minute).padStart(2, "0")}:00Z`;
const msg = (id: string, minute: number, extra: Partial<Msg> = {}): Msg => ({ id, created_at: at(minute), message: id, ...extra });
const welcome: Msg = { id: "system-1", created_at: new Date(0).toISOString(), message: "Bienvenidos" };

const ids = (list: Msg[]) => list.map((m) => m.id);

describe("reconcileWindowedMessages", () => {
  it("un mensaje eliminado desaparece cuando el servidor ya no lo devuelve (historial completo)", () => {
    const current = [welcome, msg("a", 1), msg("b", 2), msg("c", 3)];
    const fetched = [msg("a", 1), msg("c", 3)];

    const result = reconcileWindowedMessages(current, fetched, 100, ["system-1"]);

    expect(ids(result)).toEqual(["system-1", "a", "c"]);
  });

  it("con la ventana llena conserva lo anterior a la ventana y revisa solo lo que cubre", () => {
    // limit 3: el servidor devuelve los 3 más nuevos (c, d, e). "a" y "b"
    // quedaron fuera de la ventana; "d" fue eliminado.
    const current = [welcome, msg("a", 1), msg("b", 2), msg("c", 3), msg("d", 4)];
    const fetched = [msg("c", 3), msg("e", 5), msg("f", 6)];

    const result = reconcileWindowedMessages(current, fetched, 3, ["system-1"]);

    expect(ids(result)).toEqual(["system-1", "a", "b", "c", "e", "f"]);
  });

  it("con la ventana llena, un mensaje eliminado dentro de la ventana desaparece", () => {
    const current = [msg("a", 1), msg("b", 2), msg("c", 3), msg("d", 4)];
    // limit 3 y el servidor devuelve b, d y e: "c" (dentro de la ventana) ya no existe.
    const fetched = [msg("b", 2), msg("d", 4), msg("e", 5)];

    const result = reconcileWindowedMessages(current, fetched, 3);

    expect(ids(result)).toEqual(["a", "b", "d", "e"]);
  });

  it("conserva el mensaje de bienvenida aunque no venga del servidor", () => {
    const result = reconcileWindowedMessages([welcome, msg("a", 1)], [msg("a", 1)], 100, ["system-1"]);

    expect(ids(result)).toContain("system-1");
  });

  it("respuesta vacía con historial completo: vacía el chat salvo la bienvenida", () => {
    // Se eliminaron todos los mensajes (o el link dejó de ser válido): el
    // servidor devolvió menos que el límite, o sea que no hay nada más.
    const result = reconcileWindowedMessages([welcome, msg("a", 1), msg("b", 2)], [], 100, ["system-1"]);

    expect(ids(result)).toEqual(["system-1"]);
  });

  it("una respuesta con la respuesta ya actualizada reemplaza la copia local (original eliminado)", () => {
    const current = [msg("a", 1), msg("b", 2, { reply_to_user_name: "Ana", reply_to_excerpt: "a" })];
    const fetched = [msg("b", 2, { reply_to_user_name: "Ana", reply_to_excerpt: null })];

    const result = reconcileWindowedMessages(current, fetched, 100);

    expect(result).toEqual(fetched);
  });

  it("no descarta un mensaje local con la misma marca de tiempo que el borde de la ventana", () => {
    // Mismo created_at que el más viejo devuelto: puede ser el que el límite cortó.
    const current = [msg("x", 3), msg("c", 3), msg("d", 4)];
    const fetched = [msg("c", 3), msg("d", 4)];

    const result = reconcileWindowedMessages(current, fetched, 2);

    expect(ids(result)).toContain("x");
  });

  it("no muta las listas recibidas", () => {
    const current = [msg("a", 1), msg("b", 2)];
    const fetched = [msg("a", 1)];

    reconcileWindowedMessages(current, fetched, 100);

    expect(ids(current)).toEqual(["a", "b"]);
  });
});
