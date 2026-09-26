import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublicLiveChat from "./PublicLiveChat";
import { getPublicLiveMessages } from "@/lib/api/stream/lives";
import { fetchPublicLiveReactions } from "@/lib/api/stream/reactions";
import type * as ReactionsModule from "@/lib/api/stream/reactions";

vi.mock("@/lib/api/stream/lives", () => ({
  getPublicLiveMessages: vi.fn(),
}));

vi.mock("@/lib/api/stream/reactions", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactionsModule>();
  return { ...actual, fetchPublicLiveReactions: vi.fn() };
});

describe("PublicLiveChat — reacciones de solo lectura", () => {
  it("muestra los contadores como chips sin botones interactivos", async () => {
    (getPublicLiveMessages as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "m1", user_id: "beto", message: "Hola a todos", created_at: "2026-09-26T10:00:00Z", user_name: "Beto" },
    ]);
    (fetchPublicLiveReactions as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Map([["m1", { heart: { count: 3, mine: false } }]])
    );

    render(
      <MemoryRouter>
        <PublicLiveChat token="token-1" loginPath="/login" showWelcome={false} />
      </MemoryRouter>
    );

    await screen.findByText("Hola a todos");
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /corazón/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
