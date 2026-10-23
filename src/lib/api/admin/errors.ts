import { supabase } from "@/lib/supabase";

export type ClientErrorKind = "platform" | "network" | "offline" | "timeout";

export interface ClientErrorRow {
  id: string;
  code: string;
  created_at: string;
  user_id: string | null;
  kind: ClientErrorKind;
  source: string;
  message: string;
  status: number | null;
  request: string | null;
  path: string | null;
  occurrences: number;
  user_agent: string | null;
}

export interface ClientErrorsResult {
  rows: ClientErrorRow[];
  /** id de usuario → nombre, para mostrar a quién le pasó. */
  names: Record<string, string>;
  /** La tabla todavía no existe: falta correr sql/migrate-client-errors.sql. */
  missingTable: boolean;
}

const LIMIT = 500;

export async function fetchClientErrors(sinceIso: string): Promise<ClientErrorsResult> {
  const { data, error } = await supabase
    .from("client_errors")
    .select("id, code, created_at, user_id, kind, source, message, status, request, path, occurrences, user_agent")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    if (error.code === "42P01" || /client_errors/.test(error.message)) {
      return { rows: [], names: {}, missingTable: true };
    }
    throw error;
  }

  const rows = (data ?? []) as ClientErrorRow[];
  const ids = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => Boolean(id)))];
  const names: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    for (const p of profiles ?? []) names[p.id] = p.full_name ?? "";
  }
  return { rows, names, missingTable: false };
}

/** Un código puntual, sin límite de fecha: lo que el usuario pasó al reportar. */
export async function findClientErrorByCode(code: string): Promise<ClientErrorRow[]> {
  const { data, error } = await supabase
    .from("client_errors")
    .select("id, code, created_at, user_id, kind, source, message, status, request, path, occurrences, user_agent")
    .eq("code", code.trim().toUpperCase())
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []) as ClientErrorRow[];
}

export interface ErrorGroup {
  key: string;
  request: string | null;
  message: string;
  count: number;
  users: number;
  lastAt: string;
  lastCode: string;
}

export interface ErrorSummary {
  platform: number;
  /** Fallas de red: suma de ocurrencias (cada fila resume varias). */
  network: number;
  usersWithPlatform: number;
  usersWithNetwork: number;
  /** Las fallas de plataforma más repetidas: por dónde empezar a arreglar. */
  topPlatform: ErrorGroup[];
}

export function summarizeErrors(rows: ClientErrorRow[], top = 5): ErrorSummary {
  const platformUsers = new Set<string>();
  const networkUsers = new Set<string>();
  const groups = new Map<string, ErrorGroup & { userSet: Set<string> }>();
  let platform = 0;
  let network = 0;

  for (const r of rows) {
    if (r.kind !== "platform") {
      network += r.occurrences;
      if (r.user_id) networkUsers.add(r.user_id);
      continue;
    }
    platform++;
    if (r.user_id) platformUsers.add(r.user_id);
    const key = `${r.request ?? r.source}|${r.message}`;
    const g = groups.get(key) ?? {
      key,
      request: r.request,
      message: r.message,
      count: 0,
      users: 0,
      lastAt: r.created_at,
      lastCode: r.code,
      userSet: new Set<string>(),
    };
    g.count++;
    if (r.user_id) g.userSet.add(r.user_id);
    if (r.created_at > g.lastAt) {
      g.lastAt = r.created_at;
      g.lastCode = r.code;
    }
    groups.set(key, g);
  }

  const topPlatform = [...groups.values()]
    .map(({ userSet, ...g }) => ({ ...g, users: userSet.size }))
    .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))
    .slice(0, top);

  return {
    platform,
    network,
    usersWithPlatform: platformUsers.size,
    usersWithNetwork: networkUsers.size,
    topPlatform,
  };
}
