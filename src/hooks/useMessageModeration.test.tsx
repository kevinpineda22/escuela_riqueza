import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { useMessageModeration } from "./useMessageModeration";
import { toast } from "@/components/ui/toaster";
import { deleteLiveMessage, MessageDeleteRefusedError } from "@/lib/api/stream/messages";
import type * as MessagesModule from "@/lib/api/stream/messages";
import type { RemovableMessage } from "@/lib/chat/removeMessage";

vi.mock("@/components/ui/toaster", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api/stream/messages", async (importOriginal) => {
  const actual = await importOriginal<typeof MessagesModule>();
  return { ...actual, deleteLiveMessage: vi.fn() };
});

const deleteMock = deleteLiveMessage as unknown as ReturnType<typeof vi.fn>;

const initial: RemovableMessage[] = [
  { id: "m1", created_at: "2026-10-09T10:00:00Z" },
  { id: "m2", created_at: "2026-10-09T10:01:00Z" },
];

function setup() {
  const onRemoved = vi.fn();
  const onRestored = vi.fn();
  const hook = renderHook(() => {
    const [messages, setMessages] = useState(initial);
    const moderation = useMessageModeration({ messages, setMessages, onRemoved, onRestored });
    return { messages, ...moderation };
  });
  return { ...hook, onRemoved, onRestored };
}

async function confirmDeleteOf(hook: ReturnType<typeof setup>, message: RemovableMessage) {
  act(() => hook.result.current.requestDelete(message));
  await act(async () => {
    await hook.result.current.confirmDelete();
  });
}

describe("useMessageModeration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("quita el mensaje al instante y avisa cuando el servidor lo elimina", async () => {
    deleteMock.mockResolvedValue("deleted");
    const hook = setup();

    await confirmDeleteOf(hook, initial[0]);

    expect(hook.result.current.messages.map((m) => m.id)).toEqual(["m2"]);
    expect(hook.onRemoved).toHaveBeenCalledWith("m1");
    expect(hook.onRestored).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Mensaje eliminado");
  });

  it("si otro admin ya lo había borrado ('already-deleted') NO lo restaura", async () => {
    deleteMock.mockResolvedValue("already-deleted");
    const hook = setup();

    await confirmDeleteOf(hook, initial[0]);

    expect(hook.result.current.messages.map((m) => m.id)).toEqual(["m2"]);
    expect(hook.onRestored).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Mensaje eliminado");
  });

  it("si el servidor lo rechaza (el mensaje sigue existiendo) lo restaura y avisa", async () => {
    deleteMock.mockRejectedValue(new MessageDeleteRefusedError("m1"));
    const hook = setup();

    await confirmDeleteOf(hook, initial[0]);

    expect(hook.result.current.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(hook.onRestored).toHaveBeenCalledWith("m1");
    expect(toast.error).toHaveBeenCalledWith("No se pudo eliminar el mensaje");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("si falla la red lo restaura y avisa", async () => {
    deleteMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const hook = setup();

    await confirmDeleteOf(hook, initial[1]);

    expect(hook.result.current.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(hook.onRestored).toHaveBeenCalledWith("m2");
    expect(toast.error).toHaveBeenCalledWith("No se pudo eliminar el mensaje");
  });
});
