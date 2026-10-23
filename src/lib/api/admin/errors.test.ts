import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { summarizeErrors, type ClientErrorRow } from "./errors";

let n = 0;
function row(over: Partial<ClientErrorRow>): ClientErrorRow {
  n++;
  return {
    id: `id-${n}`,
    code: `CODE${String(n).padStart(2, "0")}`,
    created_at: `2026-10-23T10:${String(n).padStart(2, "0")}:00Z`,
    user_id: null,
    kind: "platform",
    source: "api",
    message: "boom",
    status: 500,
    request: "POST /api/x",
    path: "/dashboard",
    occurrences: 1,
    user_agent: null,
    ...over,
  };
}

describe("summarizeErrors", () => {
  it("separa plataforma de red y suma las ocurrencias agrupadas de red", () => {
    const s = summarizeErrors([
      row({ user_id: "u1" }),
      row({ user_id: "u2" }),
      row({ kind: "network", occurrences: 7, user_id: "u3" }),
      row({ kind: "offline", occurrences: 3, user_id: "u3" }),
    ]);
    expect(s).toMatchObject({ platform: 2, network: 10, usersWithPlatform: 2, usersWithNetwork: 1 });
  });

  it("agrupa la misma falla y ordena por cuántas veces pasó", () => {
    const s = summarizeErrors([
      row({ request: "GET /rest/v1/lessons", message: "HTTP 503", user_id: "u1" }),
      row({ request: "POST /api/x", message: "boom" }),
      row({ request: "GET /rest/v1/lessons", message: "HTTP 503", user_id: "u2" }),
      row({ request: "GET /rest/v1/lessons", message: "HTTP 503", user_id: "u2" }),
    ]);
    expect(s.topPlatform[0]).toMatchObject({ request: "GET /rest/v1/lessons", count: 3, users: 2 });
    expect(s.topPlatform[1]).toMatchObject({ request: "POST /api/x", count: 1 });
  });
});
