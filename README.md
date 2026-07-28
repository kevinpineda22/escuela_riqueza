# Escuela de la Riqueza

Plataforma educativa de Iván Mazo con planes Free / Individual / VIP, lives en vivo y panel admin self-service.

## Stack

- **Vite + React 19 + TypeScript** (frontend SPA)
- **Tailwind CSS 4** (estilos, paleta gold/dark)
- **React Router 7** (routing)
- **Supabase** (auth, Postgres + RLS, Realtime, Storage chico)
- **Cloudflare Stream** (VOD + lives) + **R2** (recursos)
- **Stripe** (suscripciones)
- **Vercel Serverless Functions** (`/api/*.ts`) para firmar URLs y webhooks
- **Vercel** (deploy)

> Documentación completa para colaboradores y agentes IA: ver [`CLAUDE.md`](./CLAUDE.md).
> Detalles de arquitectura y flujos: ver [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Inicio rápido

Requiere Node 20+.

```bash
npm install
cp env.example .env.local    # Completar con credenciales de Supabase, Stripe, Cloudflare
npm run dev                  # http://localhost:5173
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción a `dist/` |
| `npm run preview` | Sirve el build local |
| `npm run lint` | ESLint |

## Variables de entorno

Ver [`env.example`](./env.example) para la lista completa con descripción.

## Estructura

```
api/         # Vercel Serverless Functions (firma de URLs, webhooks)
src/         # Aplicación React
sql/         # Esquema de base de datos (Supabase) — ver sql/README.md
scripts/     # Scripts de mantenimiento (one-off)
worker/      # Cloudflare Worker: archivado de grabaciones a R2
docs/        # Documentación técnica
public/      # Assets estáticos
```

## Despliegue

Push a `master` → Vercel deploya automáticamente.
Branches feature → preview deployments por PR.

## Licencia

Propietario — Iván Mazo / Escuela de la Riqueza. Todos los derechos reservados.
