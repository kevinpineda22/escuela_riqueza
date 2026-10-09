import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";
import { deleteLiveMessage } from "./messages";

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));

const from = supabase.from as unknown as ReturnType<typeof vi.fn>;
const eq = vi.fn();
const select = vi.fn();

describe("deleteLiveMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eq.mockReturnValue({ select });
    from.mockReturnValue({ delete: () => ({ eq }) });
  });

  it("elimina por id y resuelve cuando Supabase devuelve la fila borrada", async () => {
    select.mockResolvedValue({ data: [{ id: "m1" }], error: null });

    await expect(deleteLiveMessage("m1")).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledWith("live_messages");
    expect(eq).toHaveBeenCalledWith("id", "m1");
    expect(select).toHaveBeenCalledWith("id");
  });

  it("lanza si Supabase devuelve un error", async () => {
    select.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(deleteLiveMessage("m1")).rejects.toEqual({ message: "boom" });
  });

  it("lanza si RLS filtró la fila (0 filas borradas, sin error)", async () => {
    select.mockResolvedValue({ data: [], error: null });

    await expect(deleteLiveMessage("m1")).rejects.toThrow(/No se eliminó ninguna fila/);
  });
});
