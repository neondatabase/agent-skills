# Connecting to Postgres from Neon Functions

## Connecting to Postgres

When the branch has Postgres, Neon **injects the connection strings at runtime** — you don't declare them, pass them at deploy time, or hardcode anything. The two you'll use:

- `DATABASE_URL` — **pooled** connection string (routed through Neon's connection pooler). Use it for normal request/response query traffic. Kept un-prefixed because every Postgres ORM (Drizzle, Prisma, Knex, …) reads `DATABASE_URL` by default.
- `DATABASE_URL_UNPOOLED` — **direct** connection string to the same database. Use it for migrations, `LISTEN`/`NOTIFY`, and long multi-statement transactions.

**Use Drizzle (or another ORM) on top of node-postgres (`pg`)** for queries and schema management — not Neon's serverless driver. Functions are long-running and reuse an isolate across many requests, so a persistent `pg` pool is the right fit; the serverless driver's HTTP transport is meant for fully isolated, lambda-style runtimes.

Create the connection pool **once at module scope** and reuse it across requests — don't open a connection per request:

```typescript
import { attachDatabasePool } from "@neon/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
attachDatabasePool(pool);
const db = drizzle(pool);
```

node-postgres emits idle-client failures as `error` on the pool. With no listener that is an `uncaughtException` and Node exits the isolate. Call `attachDatabasePool(pool)` once after `new Pool`. Requires `@neon/functions` ≥ 0.8.0. Expected idle disconnects (`ECONNRESET`, `EPIPE`, `ETIMEDOUT`, Postgres `57P01`, node-postgres's `Connection terminated unexpectedly`) are silent. Anything else is `console.error`, or `onUnexpectedError` if you pass it on the first call. The first call wins; a later call that passes `onUnexpectedError` is ignored and warns. This does not close the pool.

**Pooling is recommended because an isolate is reused across many requests** (and several requests can be in flight on the same isolate at once — see [Timeouts and Runtime Limits](runtime-limits.md#timeouts-and-runtime-limits)). A module-scope pool is opened once on cold start and then shared by every subsequent request that isolate serves, so you amortize connection setup instead of paying it on every request and you avoid exhausting Postgres connections under load.

Keep `max` small (e.g. `5`): each isolate keeps its own pool, so total connections to Postgres scale with the number of live isolates. You don't need to close the pool on shutdown — when the runtime evicts an isolate it sends `SIGINT`/`SIGTERM`, and Neon's pooler reclaims those connections for you, so an explicit drain handler is redundant.

> Reading `process.env.DATABASE_URL` directly works everywhere. The function in [Setup](../SKILL.md#setup) instead uses `@neon/env`'s `parseEnv(config)` to read the same value in a typed, validated way — either is fine.
