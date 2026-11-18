---
name: neon-functions
description: >-
  Long-running, serverless Node.js HTTP functions deployed onto your Neon
  branch, with DATABASE_URL injected automatically and compute that runs next
  to your data. Use when a user wants to host an API, an AI agent with long
  streaming responses, a WebSocket or server-sent-events (SSE) server, a
  webhook handler, a Discord bot, an MCP server, or any request/response
  workload that risks timing out on short, lambda-style serverless functions —
  and wants it to branch with their database. Also use for Function Triggers:
  a cron or an object-storage event that POSTs to a function. Triggers include
  "serverless function", "deploy an API", "long-running function",
  "streaming agent", "SSE server", "WebSocket server", "webhook handler",
  "MCP server", "cron", "scheduled function", "object storage trigger",
  "on upload", "function that won't time out", "function logs",
  "Neon Functions", "Neon Compute", "DDoS protection", "rate limiting", and
  "production hardening". For live UIs over database rows, use neon-realtime.
metadata:
  parent: neon
  source: https://github.com/neondatabase/agent-skills/tree/main/skills/neon-functions
---

**FIRST**: Use the parent `neon` skill for a Neon overview, getting started with Neon, Neon development best practices, and more.

If the `neon` skill is not installed, fetch it from https://neon.com/docs/ai/skills/neon/SKILL.md or install it with:

```bash
neon skills -s neon -y
```

# Neon Functions

Currently available in `aws-us-east-2`, `aws-us-east-1`, `aws-eu-central-1`, and `aws-ap-southeast-1`.

Neon Functions are long-running Node.js HTTP handlers deployed onto a Neon branch. Each function gets a public HTTPS URL, runs in the same region as your database, and — if the branch has Postgres — gets `DATABASE_URL` injected automatically. You deploy and manage them through the same Neon CLI, `neon.ts`, and API you already use.

Use this skill to help the user define, run locally, deploy, and manage functions next to their database. Deliver a deployed function with its invocation URL, a working local `neon dev` loop, or a precise answer from the official Neon docs.

## When to Use

Reach for Neon Functions when the workload is a request/response handler that benefits from staying alive and staying close to the data:

- **Long-running request/response flows that outlast lambda-style limits.** Agents that make several LLM calls and tool invocations per request, or image/video generation, routinely blow past the ~10–60s execution caps and short streaming windows of traditional serverless functions. Neon Functions are long-running: the handler just needs to _start_ responding within 15 minutes, and an open stream stays alive as long as bytes keep flowing. That's enough headroom for real agent workloads.
- **Stateful streaming without bolting on Redis.** Because a function stays alive across a request, it can host an SSE endpoint or a WebSocket server and hold the connection open in-process — no external state store (Redis, etc.) needed just to keep a stream coherent. Module-scope state (a `pg` pool, an in-memory counter) persists across requests on the same isolate.
- **Compute that must sit next to Postgres.** The function runs in the same region as the branch's database, so there are no cross-region round trips on every query. `DATABASE_URL` is injected for you.
- **A backend that branches with your data.** Each branch runs its own version of the function at its own URL, against its own isolated database (and storage, and gateway) state. Preview deployments, CI, and dev environments each get a self-contained backend — deploying to a child never affects the parent.
- **Query Postgres from the Function (or an existing framework handler).** Prefer that over the Data API. Use the Data API when the application already uses PostgREST or Supabase-js database calls, or is migrating that client.
- **Webhooks, bots, and post-response work.** Webhook handlers that fan out into multiple DB writes, Discord/WebSocket bots, and fire-and-forget follow-ups via `waitUntil` (analytics, audit logs) all fit.
- **Recurring HTTP work.** A Function Trigger POSTs to the function on a cron (`type: "schedule"`) or when an object is created in Object Storage (`type: "storage_object_created"`). Same `fetch` handler, same 15-minute time-to-first-byte limit. See [Function Triggers](#function-triggers).

If the workload is a pure static site, or something that must run outside the supported regions (`aws-us-east-2`, `aws-us-east-1`, `aws-eu-central-1`, and `aws-ap-southeast-1`) today, this isn't the right tool yet (see [Timeouts and Runtime Limits](#timeouts-and-runtime-limits) and [Availability](#availability)).

## What It Does

- **Long-running & serverless** — Built for WebSocket servers (see [WebSocket Servers](references/websockets.md)), SSE endpoints (see [Server-Sent Events (SSE)](#server-sent-events-sse)), long agent HTTP streams, and APIs. Still scales to zero when idle.
- **Web-standard handler** — A function is any default export with a `fetch(request)` method returning a `Response` (Workers/WinterTC-compatible). A Hono app exports exactly that shape, so `export default app` just works. Runs on Node.js 24, so all Node APIs are available.
- **Close to your database** — Runs in the branch's region; `DATABASE_URL` injected automatically when the branch has Postgres.
- **Branchable** — Each branch runs its own function version at its own URL against its own isolated state.
- **Same CLI/API** — Deploy and manage via `neon`, `neon.ts`, or the Neon API.
- **Function Triggers** — Neon POSTs to the function on a cron or an object-storage upload. See [Function Triggers](#function-triggers).

## Availability

Check this precondition before setting anything up: Neon Functions is currently available in `aws-us-east-2`, `aws-us-east-1`, `aws-eu-central-1`, and `aws-ap-southeast-1`. Confirm the user's Neon project is in one of these regions.

## Architecture: Where Functions Fit

Neon (Functions included) is **backend primitives, not full-stack app hosting**. Host your app on a frontend hosting provider like **Vercel** (or Netlify, Cloudflare, etc.), or serve a small static page from a `public_read` bucket behind a CDN (see the `neon-object-storage` skill for caching); Functions are the long-running, stateful slice of your backend that lives next to your data. They compose with that platform in two ways:

- **Add a Function to a full-stack app.** Your Next.js / TanStack Start app on Vercel (or Netlify) owns UI, auth (Managed Auth, Better Auth, Clerk, or another IdP), and talks directly to Lakebase Postgres and Object Storage. Add a Function as a Hono API layer for the web app and other clients, or for one job next to the data: Object Storage uploads, AI agents, Discord bots, WebSocket or SSE servers. (See [Functions as an Agent Backend](#functions-as-an-agent-backend-nextjs-and-similar-frameworks) for the client-direct pattern.)
- **Run the whole backend control plane on Functions.** Especially when the frontend is **client-only** — TanStack Router, React Router in client mode, and similar SPAs hosted on Vercel or Netlify — the client calls Functions **directly**. Build REST APIs and request/response agents, host **MCP servers**, and run anything stateful or that belongs close to Postgres and Object Storage.

Either way, authenticate by caller: JWT or API key for app and public HTTP (see the WARNING under [Functions as an Agent Backend](#functions-as-an-agent-backend-nextjs-and-similar-frameworks)); `parseTriggerDelivery` for Function Trigger routes; production hardening in [Production hardening](references/production-hardening.md). Because a Function is just your backend, you can **move pieces between your host and Neon** — relocate an agent or a stateful WebSocket server onto a Function when it needs more runtime, and back if needed.

Prefer a Function, or an existing framework handler, that queries Postgres. Use Data API when the application already uses PostgREST/Supabase-js database calls or is migrating that client.

## Production hardening

Before exposing production routes, read [Production hardening](references/production-hardening.md).

Pick by caller: trusted app server, Function Trigger, or public consumer. Keep long browser streams on the client-direct JWT path unless a verified streaming-compatible proxy is required. Authentication rejects application work; requests to the native URL still reach the Function.

## Setup

Functions are declared in `neon.ts` (see the `neon` skill for the branch-first workflow and `neon.ts` basics). Add `@neon/config` and declare functions under `functions`, keyed by **slug**:

```typescript
// neon.ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  functions: {
    todos: {
      // slug: ^[a-z0-9]{1,20}$ — lowercase letters/digits, no hyphens
      name: "todo api", // display label only
      source: "src/index.ts", // entry file, relative to neon.ts
    },
  },
});
```

The slug is the function's permanent identity (it appears in the invocation URL and CLI commands) and can't be changed after the first deploy. Use `name` for a human-readable label.

A minimal function — a Hono app that queries the branch's Postgres via the injected `DATABASE_URL`:

```typescript
// src/index.ts
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { parseEnv } from "@neon/env";
import { attachDatabasePool } from "@neon/functions";
import config from "../neon";
import { todos } from "./db/schema";

const env = parseEnv(config);
const pool = new Pool({ connectionString: env.postgres.databaseUrl, max: 5 });
attachDatabasePool(pool);
const db = drizzle(pool);

const app = new Hono();
app.get("/", (c) => c.text("Neon + Hono + Drizzle"));
app.post("/todos", async (c) => {
  const { text } = await c.req.json<{ text: string }>();
  const [row] = await db.insert(todos).values({ text }).returning();
  return c.json(row, 201);
});
app.get("/todos", async (c) => c.json(await db.select().from(todos)));

export default app;
```

Create the `pg` pool at module scope (reused across requests on the same isolate) and keep `max` small (e.g. 5), since each isolate keeps its own pool. Call `attachDatabasePool(pool)` so an idle disconnect is not an `uncaughtException` — see [Connecting to Postgres](#connecting-to-postgres).

`parseEnv(config)` requires _every_ variable the config implies. To validate only some keys, such as just `DATABASE_URL`, see [Validate only the variables a function needs](references/environment-variables.md#validate-only-the-variables-a-function-needs).

## Develop Locally and Deploy

```bash
neon dev      # serves every function in neon.ts with hot reload; injects DATABASE_URL & friends
neon deploy --env <file>   # preferred full deploy from neon.ts; --env is the file Function env is read from
```

Keep `.env` or `.env.local` up to date with every key under `functions.*.env`. `neon env pull` writes Neon-managed vars only; add Function secrets to that file, then pass it as `--env`. `neon deploy --env <file>` loads that file into `process.env` each time, then uploads the declared values. Declare each secret as `{ value: process.env.X, required: true }` (see [Environment Variables](#environment-variables)): an unset required value fails `neon deploy` and `neon dev` before anything changes, and never fails an import of `neon.ts`. Never coerce a missing value to `""` (that uploads `""` and deletes the live key); an empty assignment (`KEY=`) counts as unset.

To deploy a single function without applying `neon.ts`: `neon functions deploy <slug> --src src/index.ts` (`--src` takes either the entry file or a directory containing `index.ts`, `index.mjs`, or `index.js`). That command's `--env` is `KEY=VALUE` (repeatable), not a file path. Use it for a targeted env update. Retrieve the public URL with `neon functions get <slug>` (the `invocation_url` field, of the form `https://<branch_id>-<slug>.compute.<cell>.us-east-2.aws.neon.tech`). Manage with `neon functions list|get|delete`.

When `neon checkout` _creates_ a new branch and a `neon.ts` is present, it applies the policy automatically. Pass `--env <file>` on that create so Function env that reads `process.env` resolves (`neon checkout feat --create --env .env.local`). Existing process env wins over the file. Checking out an existing branch never reconciles it — apply config changes with `neon deploy --env <file>` (add `--update-existing` only after reviewing those changes).

### Native binaries and custom builds

The default deploy bundles `source` into one `index.mjs`, which cannot hold a compiled binary (`sharp` and other Node addons, `.node`, `.so`, `.wasm`, or an executable you spawn). **Before you ship one, read [references/native-binaries.md](references/native-binaries.md)**: it has `externalPackages`, `bundler: "none"`, a custom `bundler`, and why executables must be copied to `/run`.

## Neon Infrastructure as Code (`neon.ts`)

The `functions` block is part of `neon.ts`, Neon's infrastructure-as-code file (see the `neon` skill). Functions are **branch-scoped**: each branch runs its own deployment at its own URL, and checking out an _existing_ branch doesn't redeploy. **Before you change `neon.ts` or tune a function per branch, read [references/neon-ts.md](references/neon-ts.md)** for `neon config status|plan|apply` and the `branch` closure (for example `runtime`).

## Environment Variables

Neon injects `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (direct), `NEON_BRANCH`, `NEON_BRANCH_ID`, `NEON_FUNCTION_HOST_SUFFIX`, and the variables of other services on the branch (Auth, Data API, Object Storage, AI Gateway). Don't declare or pass them. Declare your own secrets in `neon.ts` as shown in [Develop Locally and Deploy](#develop-locally-and-deploy). **Before you add or change a Function secret, read [references/environment-variables.md](references/environment-variables.md)** for the full variable table, what each `required` value does per branch and in `neon dev`, `onUndefined: "skip"`, minimum versions, and limits.

## How to get the function URL

Each branch has its own URL: `https://<NEON_BRANCH_ID>-<slug><NEON_FUNCTION_HOST_SUFFIX>`. Run `neon functions get <slug>` (`invocation_url`), or in code call `functionBaseUrl(slug)` from `@neon/env` 2.0.0 or later. The old `NEON_FUNCTION_<SLUG>_BASE_URL` variables are removed. Browsers can't read these variables, so build the URL on the server. **Before you call a function by URL from code, read [the function URL section](references/environment-variables.md#how-to-get-the-function-url).**

## Connecting to Postgres

Use Drizzle (or another ORM) on node-postgres (`pg`), not Neon's serverless driver. Create one pool **at module scope** with a small `max` (e.g. `5`) and call `attachDatabasePool(pool)` (`@neon/functions` 0.8.0 or later) right after it, or an idle disconnect crashes the isolate. Use `DATABASE_URL_UNPOOLED` for migrations, `LISTEN`/`NOTIFY`, and long transactions. **Before you write database code in a function, read [references/postgres.md](references/postgres.md).**

## Timeouts and Runtime Limits

Functions are long-running but **still serverless**: a request/response runtime, not a background job runner.

- **15 minutes** to the first byte of a response, 15 minutes of silence before an open WebSocket/SSE stream closes, and 15 minutes for `waitUntil` work after the response.
- **Isolates are reused and run in parallel.** Module state is per-isolate and lost on eviction, so persist what matters in Postgres. Clients must reconnect after eviction.
- Node.js 24, 2048 MiB memory, slugs match `^[a-z0-9]{1,20}$`.

**Before you design long-running work, `waitUntil`, or eviction handling, read [references/runtime-limits.md](references/runtime-limits.md).**

## Functions as an Agent Backend (Next.js and Similar Frameworks)

**Don't proxy a long agent stream** through a Next.js route, Remix/SvelteKit/Nuxt action, or similar on Vercel or Netlify: the host cuts it. The browser calls the Function directly with `Authorization: Bearer <short-lived token>` from the identity the app already uses, plus CORS. Build the agent with the Vercel AI SDK or Mastra on the Neon AI Gateway.

> [!WARNING]
> A Neon Function has a **public HTTPS URL — it is reachable by anyone.** A direct client→function call means there is no app backend in front of it to gate access, so **you must authenticate the function yourself.** Verify a JWT against the caller's JWKS, check a shared secret / API key, or reject the request. Never deploy an unauthenticated agent. Browser callers use short-lived user tokens. Server or proxy origin secrets (`X-Secret`) stay server-side; see [Production hardening](references/production-hardening.md).

**Before you build an agent backend or any browser-to-Function call, read [references/agent-backend.md](references/agent-backend.md)** for getting the token from each identity provider, the JWT verification and CORS code, and the two-user test. A valid token is not permission to read another user's rows.

## WebSocket Servers

Upgrade inside `fetch` with `upgradeWebSocket(request)` from `@neon/functions` (Hono: `@neon/functions/hono`), return its `response` unchanged, and authenticate with `?token=` before upgrading. For live UIs over database rows, use the `neon-realtime` skill. **Before you write a WebSocket server, read [references/websockets.md](references/websockets.md).** Every server needs all three:

- **Heartbeat:** an application-level ping about every 25 seconds.
- **Fan-out across isolates (do not skip this):** in-process broadcast works in `neon dev` but silently breaks in production. Poll Postgres by default.
- **Client reconnect:** capped exponential backoff with a fresh token each attempt.

## Server-Sent Events (SSE)

For **server → client** streaming only, SSE is simpler than a WebSocket: return a `Response` whose body is a `ReadableStream` with `Content-Type: text/event-stream`, and the browser's `EventSource` reconnects on its own. The WebSocket rules still apply: a `: ping\n\n` heartbeat every ~25–30s, state in Postgres, and [fan-out across isolates](references/websockets.md#fan-out-across-isolates-do-not-skip-this). Authenticate with `?token=` or a cookie. **Before you write an SSE endpoint, read [references/sse.md](references/sse.md).**

## Function Triggers

A Function Trigger POSTs JSON to your function on a cron (`schedule`) or when an object is created in Object Storage (`storage_object_created`). Declare it in `neon.ts`, apply with `neon deploy`, and authenticate the delivery with `parseTriggerDelivery` (`@neon/functions/triggers`). `parseTrigger` (Hono) and `parseTriggerInvocation` stay schedule-only. Prefer `neon.ts`; CLI and the Neon MCP trigger tools (`list_triggers`, `create_trigger`, …) are the backup.

Trigger routes must not require a user JWT or `X-Secret`; Neon POSTs to the native URL without those. Production caller shapes: [references/production-hardening.md](references/production-hardening.md). Full field list, CLI, MCP, payload, inheritance, and both handler shapes: [references/function-triggers.md](references/function-triggers.md).

## MCP Servers

An [MCP](https://modelcontextprotocol.io) server fits Functions well: MCP's streamable HTTP transport is a plain `POST` on one endpoint (`/mcp`). Use the official `@modelcontextprotocol/sdk` 1.30.0 or later with `WebStandardStreamableHTTPServerTransport` on Hono, build a stateless server and transport per request, and return `405` with `Allow: POST` for GET and DELETE. Use `@hono/mcp` only for a known client that doesn't send the MCP `Accept` headers.

Because the function's URL is public, **authenticate before connecting the transport**: Managed Better Auth as the OAuth server for third-party clients (`@neon/oauth`; see the `neon-auth` skill's [oauth-server.md](https://neon.com/docs/ai/skills/neon-auth/references/oauth-server.md)), or an API-key or session-JWT check for your own callers. Public-consumer edge protection: [references/production-hardening.md](references/production-hardening.md). **Before you build an MCP server, read [references/mcp.md](references/mcp.md).**

## Integrations and Observability

### Built-in branch logs

```bash
neon logs query --branch production --source function --since 1h
```

Functions is one of the two sources branch logs cover today, alongside Object Storage. Logs are scoped to a single branch, so pass `--branch` when the deployed function isn't on the branch you're checked out on. Everything else about logs — the required CLI version, filters, the SDK, and the Loki-compatible read API — is in the parent `neon` skill's **Observability** section.

### Application instrumentation

A function is a long-lived Node.js process running a web-standard request/response handler, so standard Node integration SDKs work unchanged. Initialize them once at module load, gated on an env var so local dev and unconfigured branches stay a no-op, and pass secrets via `--env` or `neon.ts` `env`.

- **Sentry** — error monitoring across the HTTP framework, the function runtime, and an agent's own caught/fallback failures (the long-running case Functions target): see [references/sentry.md](https://neon.com/docs/ai/skills/neon-functions/references/sentry.md).
- **Mastra Studio (Mastra Cloud)** — run a Mastra agent on a function and ship its traces to a Studio project for observability: see [references/mastra-studio.md](https://neon.com/docs/ai/skills/neon-functions/references/mastra-studio.md).

## Neon Documentation

The Neon documentation is the source of truth and Functions is evolving rapidly, so always verify against the official docs. Any doc page can be fetched as markdown by appending `.md` to the URL or by requesting `Accept: text/markdown`. Find the right page from the docs index (https://neon.com/docs/llms.txt) and the changelog announcements.

## Further Reading

- https://neon.com/docs/compute/functions/overview.md
- https://neon.com/docs/compute/functions/get-started.md
- https://neon.com/docs/compute/functions/deploy.md
- https://neon.com/docs/compute/functions/environment-variables.md
- https://neon.com/docs/compute/functions/reference/neon-ts.md
- https://neon.com/docs/compute/functions/reference/runtime-limits.md
- https://neon.com/docs/compute/functions/authentication.md
- https://neon.com/docs/compute/functions/custom-domains.md
- https://neon.com/docs/cli/triggers.md
- [references/function-triggers.md](references/function-triggers.md)
- [references/native-binaries.md](references/native-binaries.md)
- [references/production-hardening.md](references/production-hardening.md)
