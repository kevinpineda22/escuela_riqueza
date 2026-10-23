import { useEffect, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Bug, Loader2, Search, Users, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchClientErrors,
  findClientErrorByCode,
  summarizeErrors,
  type ClientErrorRow,
  type ClientErrorsResult,
} from "@/lib/api/admin/errors";

const PERIODS = [
  { id: "24h", label: "24 h", hours: 24 },
  { id: "7d", label: "7 días", hours: 24 * 7 },
  { id: "30d", label: "30 días", hours: 24 * 30 },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

const KIND_LABEL: Record<ClientErrorRow["kind"], string> = {
  platform: "Plataforma",
  network: "Red",
  offline: "Sin internet",
  timeout: "Red lenta",
};

const dateFmt = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const formatDate = (iso: string) => dateFmt.format(new Date(iso));

/** "Chrome · Android", lo justo para saber desde dónde. */
function shortAgent(ua: string | null): string {
  if (!ua) return "—";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Otro";
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : "";
  return os ? `${browser} · ${os}` : browser;
}

type Loaded = ClientErrorsResult & { period: PeriodId };

/**
 * ¿Es de la plataforma o de la red? Fallas que registraron los navegadores
 * (src/lib/errors). Plataforma = el servidor respondió con error o falló el
 * código; red = el pedido nunca llegó (internet del usuario).
 */
const AdminErrors = () => {
  const [period, setPeriod] = useState<PeriodId>("7d");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [codeQuery, setCodeQuery] = useState("");
  const [codeResult, setCodeResult] = useState<{ code: string; rows: ClientErrorRow[] } | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let active = true;
    const hours = PERIODS.find((p) => p.id === period)?.hours ?? 24 * 7;
    fetchClientErrors(new Date(Date.now() - hours * 3600 * 1000).toISOString())
      .then((result) => {
        if (!active) return;
        setLoaded({ ...result, period });
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (active) setLoadError(err instanceof Error ? err.message : "No se pudieron cargar los errores");
      });
    return () => {
      active = false;
    };
  }, [period]);

  const searchCode = async (e: FormEvent) => {
    e.preventDefault();
    const code = codeQuery.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setCodeResult({ code, rows: [] });
      return;
    }
    setSearching(true);
    try {
      setCodeResult({ code, rows: await findClientErrorByCode(code) });
    } catch {
      setCodeResult({ code, rows: [] });
    } finally {
      setSearching(false);
    }
  };

  const loading = !loaded || loaded.period !== period;
  const rows = loaded?.rows ?? [];
  const names = loaded?.names ?? {};
  const summary = summarizeErrors(rows);
  const platformRows = rows.filter((r) => r.kind === "platform").slice(0, 100);
  const total = summary.platform + summary.network;
  const networkShare = total > 0 ? Math.round((summary.network / total) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground-strong tracking-tight flex items-center gap-3">
            <Bug className="text-accent" /> Errores
          </h1>
          <p className="text-foreground-muted mt-1">¿Es de la plataforma o de la red del usuario? Lo que registraron los navegadores.</p>
        </div>
        <div className="flex rounded-xl border border-line-subtle bg-ink/5 p-1" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-bold transition-colors",
                period === p.id ? "bg-brand text-on-brand" : "text-fg-70 hover:text-foreground-strong",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={searchCode} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="error-code" className="text-sm font-semibold text-foreground-strong">Buscar un código que te pasaron</label>
        <div className="flex gap-2">
          <input
            id="error-code"
            value={codeQuery}
            onChange={(e) => setCodeQuery(e.target.value)}
            placeholder="K7F2QA"
            maxLength={6}
            className="w-32 rounded-lg border border-line-subtle bg-surface-panel px-3 py-2 font-mono text-base uppercase tracking-widest text-foreground-strong outline-none focus:border-brand/50"
          />
          <button type="submit" className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-bold text-accent hover:bg-brand/20">
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Buscar
          </button>
        </div>
      </form>
      {codeResult ? (
        codeResult.rows.length === 0 ? (
          <p className="text-sm text-foreground-muted">No hay ningún error con el código <span className="font-mono font-bold">{codeResult.code || "—"}</span>.</p>
        ) : (
          <ErrorTable rows={codeResult.rows} names={names} />
        )
      ) : null}

      {loadError ? <p role="alert" className="text-sm text-danger">{loadError}</p> : null}

      {loaded?.missingTable ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground-strong">
          Falta crear la tabla de errores: corre <code>sql/migrate-client-errors.sql</code> en el editor SQL de Supabase.
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-foreground-muted"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={<AlertTriangle size={18} className="text-danger" />}
              label="Fallas de la plataforma"
              value={summary.platform}
              hint={`${summary.usersWithPlatform} usuario${summary.usersWithPlatform === 1 ? "" : "s"} afectado${summary.usersWithPlatform === 1 ? "" : "s"}`}
            />
            <SummaryCard
              icon={<WifiOff size={18} className="text-fg-60" />}
              label="Fallas de red de los usuarios"
              value={summary.network}
              hint={`${summary.usersWithNetwork} usuario${summary.usersWithNetwork === 1 ? "" : "s"} con sesión`}
            />
            <SummaryCard
              icon={<Users size={18} className="text-accent" />}
              label="Del total, son de red"
              value={`${networkShare} %`}
              hint={total === 0 ? "Sin fallas en este período" : "No dependen de la plataforma"}
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground-strong">Las fallas de plataforma que más se repiten</h2>
            {summary.topPlatform.length === 0 ? (
              <p className="text-sm text-foreground-muted">Ninguna en este período.</p>
            ) : (
              <ul className="divide-y divide-line-subtle rounded-2xl border border-line-subtle">
                {summary.topPlatform.map((g) => (
                  <li key={g.key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-foreground-strong">{g.request ?? "—"}</p>
                      <p className="truncate text-xs text-foreground-muted">{g.message}</p>
                    </div>
                    <p className="shrink-0 text-xs text-foreground-muted">
                      <span className="font-bold text-foreground-strong">{g.count}×</span> · {g.users} usuario{g.users === 1 ? "" : "s"} · última {formatDate(g.lastAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground-strong">Últimas fallas de plataforma</h2>
            {platformRows.length === 0 ? (
              <p className="text-sm text-foreground-muted">Ninguna en este período.</p>
            ) : (
              <ErrorTable rows={platformRows} names={names} />
            )}
          </section>
        </>
      )}
    </motion.div>
  );
};

function SummaryCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number | string; hint: string }) {
  return (
    <div className="rounded-2xl border border-line-subtle bg-surface-panel p-4">
      <p className="flex items-center gap-2 text-sm text-foreground-muted">{icon} {label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-foreground-strong">{value}</p>
      <p className="mt-1 text-xs text-foreground-muted">{hint}</p>
    </div>
  );
}

function ErrorTable({ rows, names }: { rows: ClientErrorRow[]; names: Record<string, string> }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line-subtle">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-ink/5 text-xs text-foreground-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Código</th>
            <th className="px-3 py-2 font-semibold">Cuándo</th>
            <th className="px-3 py-2 font-semibold">Tipo</th>
            <th className="px-3 py-2 font-semibold">Qué falló</th>
            <th className="px-3 py-2 font-semibold">Pantalla</th>
            <th className="px-3 py-2 font-semibold">Usuario</th>
            <th className="px-3 py-2 font-semibold">Navegador</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {rows.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="px-3 py-2 font-mono font-bold tracking-widest text-foreground-strong">{r.code}</td>
              <td className="whitespace-nowrap px-3 py-2 text-foreground-muted">{formatDate(r.created_at)}</td>
              <td className="px-3 py-2">
                <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", r.kind === "platform" ? "bg-red-500/10 text-danger" : "bg-ink/10 text-fg-70")}>
                  {KIND_LABEL[r.kind]}{r.occurrences > 1 ? ` ×${r.occurrences}` : ""}
                </span>
              </td>
              <td className="max-w-[320px] px-3 py-2">
                <p className="truncate font-mono text-xs text-foreground-strong">{r.request ?? r.source}{r.status ? ` · ${r.status}` : ""}</p>
                <p className="truncate text-xs text-foreground-muted" title={r.message}>{r.message}</p>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-foreground-muted">{r.path ?? "—"}</td>
              <td className="px-3 py-2 text-foreground-muted">{r.user_id ? names[r.user_id] || "Usuario" : "Visitante"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs text-foreground-muted">{shortAgent(r.user_agent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminErrors;
