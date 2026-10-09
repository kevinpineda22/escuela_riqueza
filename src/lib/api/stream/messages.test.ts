import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";
import { deleteLiveMessage, MessageDeleteRefusedError } from "./messages";

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

const from = supabase.from as unknown as ReturnType<typeof vi.fn>;

/** Arma `from("live_messages")` con el resultado del DELETE y el del SELECT de verificación. */
const deleteEq = vi.fn();
const deleteSelect = vi.fn();

function mockQueries(
  deleteResult: { data: { id: string }[] | null; error: unknown },
  lookupResult?: { data: { id: string } | null; error: unknown }
) {
  const maybeSingle = vi.fn().mockResolvedValue(lookupResult ?? { data: null, error: null });
  deleteSelect.mockResolvedValue(deleteResult);
  deleteEq.mockReturnValue({ select: deleteSelect });
  from.mockReturnValue({
    delete: () => ({ eq: deleteEq }),
    select: () => ({ eq: () => ({ maybeSingle }) }),
  });
  return { maybeSingle };
}

describe("deleteLiveMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve 'deleted' cuando el DELETE afectó la fila, sin consultas extra", async () => {
    const { maybeSingle } = mockQueries({ data: [{ id: "m1" }], error: null });

    await expect(deleteLiveMessage("m1")).resolves.toBe("deleted");
    expect(from).toHaveBeenCalledWith("live_messages");
    expect(deleteEq).toHaveBeenCalledWith("id", "m1");
    expect(deleteSelect).toHaveBeenCalledWith("id");
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("0 filas y el mensaje ya no existe: 'already-deleted' (otro admin lo borró)", async () => {
    mockQueries({ data: [], error: null }, { data: null, error: null });

    await expect(deleteLiveMessage("m1")).resolves.toBe("already-deleted");
  });

  it("0 filas y el mensaje sigue existiendo: lanza MessageDeleteRefusedError (RLS)", async () => {
    mockQueries({ data: [], error: null }, { data: { id: "m1" }, error: null });

    const failure = deleteLiveMessage("m1");
    await expect(failure).rejects.toBeInstanceOf(MessageDeleteRefusedError);
    await expect(failure).rejects.toMatchObject({ messageId: "m1" });
  });

  it("un error del DELETE se propaga tal cual", async () => {
    const networkError = new TypeError("Failed to fetch");
    mockQueries({ data: null, error: networkError });

    await expect(deleteLiveMessage("m1")).rejects.toBe(networkError);
  });

  it("si falla la verificación, el error se propaga (no se asume que se borró)", async () => {
    const lookupError = { message: "timeout" };
    mockQueries({ data: [], error: null }, { data: null, error: lookupError });

    await expect(deleteLiveMessage("m1")).rejects.toBe(lookupError);
  });
});
