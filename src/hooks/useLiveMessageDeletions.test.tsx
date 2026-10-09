import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { useLiveMessageDeletions } from "./useLiveMessageDeletions";
import type { RemovableMessage } from "@/lib/chat/removeMessage";

const initial: RemovableMessage[] = [
  { id: "m1", created_at: "2026-10-09T10:00:00Z" },
  { id: "m2", created_at: "2026-10-09T10:01:00Z" },
];

function setup(liveId = "live-1") {
  const onDeleted = vi.fn();
  const hook = renderHook(
    ({ liveId }) => {
      const [messages, setMessages] = useState(initial);
      return { messages, ...useLiveMessageDeletions({ liveId, setMessages, onDeleted }) };
    },
    { initialProps: { liveId } }
  );
  return { ...hook, onDeleted };
}

describe("useLiveMessageDeletions", () => {
  it("markDeleted registra el tombstone, quita el mensaje y suelta lo que apunta a él", () => {
    const { result, onDeleted } = setup();

    act(() => result.current.markDeleted("m1"));

    expect(result.current.tombstonesRef.current.has("m1")).toBe(true);
    expect(result.current.messages.map((m) => m.id)).toEqual(["m2"]);
    expect(onDeleted).toHaveBeenCalledWith("m1");
  });

  it("markDeleted tiene identidad estable entre renders", () => {
    const { result, rerender } = setup();
    const first = result.current.markDeleted;

    rerender({ liveId: "live-1" });

    expect(result.current.markDeleted).toBe(first);
  });

  it("unmarkDeleted devuelve el id a la normalidad (rollback de un borrado rechazado)", () => {
    const { result } = setup();
    act(() => result.current.markDeleted("m1"));

    act(() => result.current.unmarkDeleted("m1"));

    expect(result.current.tombstonesRef.current.has("m1")).toBe(false);
  });

  it("los tombstones se vacían al cambiar de live", () => {
    const { result, rerender } = setup("live-1");
    act(() => result.current.markDeleted("m1"));

    rerender({ liveId: "live-2" });

    expect(result.current.tombstonesRef.current.size).toBe(0);
  });
});
