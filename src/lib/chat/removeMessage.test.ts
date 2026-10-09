import { describe, it, expect } from "vitest";
import { removeMessage, restoreMessage, type RemovableMessage } from "./removeMessage";

interface Msg extends RemovableMessage {
  content: string;
}

const original: Msg = { id: "m1", created_at: "2026-10-09T10:00:00Z", content: "Hola" };
const reply: Msg = {
  id: "m2",
  created_at: "2026-10-09T10:01:00Z",
  content: "Dale",
  reply_to: { id: "m1", user_id: "beto", user_name: "Beto", excerpt: "Hola" },
};
const other: Msg = { id: "m3", created_at: "2026-10-09T10:02:00Z", content: "Otro" };

describe("removeMessage", () => {
  it("quita el mensaje de la lista", () => {
    expect(removeMessage([original, other], "m1").map((m) => m.id)).toEqual(["m3"]);
  });

  it("convierte las respuestas al mensaje en respuestas a un mensaje eliminado", () => {
    const result = removeMessage([original, reply, other], "m1");

    expect(result.map((m) => m.id)).toEqual(["m2", "m3"]);
    // Misma forma que dejan el FK ON DELETE SET NULL y el trigger: sin id ni
    // extracto, con la atribución intacta.
    expect(result[0].reply_to).toEqual({ id: null, user_id: "beto", user_name: "Beto", excerpt: null });
    expect(result[1]).toBe(other);
  });

  it("no toca las respuestas a otros mensajes", () => {
    const replyToOther: Msg = { ...reply, id: "m4", reply_to: { id: "m3", user_id: "x", user_name: "X", excerpt: "Otro" } };

    const result = removeMessage([original, other, replyToOther], "m1");

    expect(result.find((m) => m.id === "m4")).toBe(replyToOther);
  });

  it("devuelve la misma lista si el id no existe (no-op)", () => {
    const list = [original, reply, other];

    expect(removeMessage(list, "desconocido")).toBe(list);
  });

  it("no muta la lista original", () => {
    const list = [original, reply];

    removeMessage(list, "m1");

    expect(list).toHaveLength(2);
    expect(list[1].reply_to?.excerpt).toBe("Hola");
  });
});

describe("restoreMessage", () => {
  it("revierte un removeMessage: vuelve el mensaje y las citas de sus respuestas", () => {
    const before = [original, reply, other];
    const after = removeMessage(before, "m1");

    const restored = restoreMessage(after, before, "m1");

    expect(restored).toEqual(before);
  });

  it("conserva los mensajes que llegaron mientras tanto", () => {
    const before = [original, reply];
    const after = removeMessage(before, "m1");
    const arrivedMeanwhile: Msg = { id: "m9", created_at: "2026-10-09T10:05:00Z", content: "Nuevo" };

    const restored = restoreMessage([...after, arrivedMeanwhile], before, "m1");

    expect(restored.map((m) => m.id)).toEqual(["m1", "m2", "m9"]);
  });

  it("no inventa un mensaje que no estaba en el snapshot", () => {
    const current = [other];

    expect(restoreMessage(current, [other], "desconocido")).toEqual([other]);
  });
});
