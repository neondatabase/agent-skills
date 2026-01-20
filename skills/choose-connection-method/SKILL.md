---
name: choose-connection-method
description: Helps choose the right Neon Postgres connection method based on deployment platform (Vercel, Cloudflare, Netlify, Railway, etc.) and runtime environment (serverless, edge, long-running). Trigger phrases include "connect to Neon", "database setup", "which driver", "connection pooling".
---

# Choose Your Neon Connection Method

This skill guides you through selecting the optimal connection method for your Neon Postgres database based on your deployment platform and runtime environment.

## Decision Tree

Follow this flow to determine the right connection approach:

### 1. What Language Are You Using?

**Not TypeScript/JavaScript** → Use **TCP with connection pooling** from a secure server.

For non-TypeScript languages, connect from a secure backend server using your language's native Postgres driver with connection pooling enabled.

Refer to the following documentation for your language/framework:

- [Django (Python)](https://neon.com/docs/guides/django)
- [SQLAlchemy (Python)](https://neon.com/docs/guides/sqlalchemy)
- [Elixir Ecto](https://neon.com/docs/guides/elixir-ecto)
- [Laravel Eloquent (PHP)](https://neon.com/docs/guides/laravel)
- [Ruby on Rails Active Record](https://neon.com/docs/guides/ruby-on-rails)

```bash
curl -H "Accept: text/markdown" https://neon.com/docs/guides/django
curl -H "Accept: text/markdown" https://neon.com/docs/guides/sqlalchemy
curl -H "Accept: text/markdown" https://neon.com/docs/guides/elixir-ecto
curl -H "Accept: text/markdown" https://neon.com/docs/guides/laravel
curl -H "Accept: text/markdown" https://neon.com/docs/guides/ruby-on-rails
```

**TypeScript/JavaScript** → Continue to step 2.

---

### 2. Client-Side App Without Backend?

**Yes** → Use **Neon Data API / PostgREST** via [`@neondatabase/neon-js`](https://github.com/neondatabase/neon-js)

This is the only option for client-side apps since browsers cannot make direct TCP connections to Postgres.

Refer to the [neon-js](https://neon.com/docs/reference/javascript-sdk) docs for more information.

```bash
curl -H "Accept: text/markdown" https://neon.com/docs/reference/javascript-sdk
```

**No** → Continue to step 3.

---

### 3. Long-Running Server? (Railway, Render, traditional VPS)

**Yes** → Use **TCP with connection pooling** via `node-postgres`, `postgres.js`, or `bun:pg`

Long-running servers maintain persistent connections, so standard TCP drivers with pooling are optimal.

**No** → Continue to step 4.

---

### 4. Edge Environment Without TCP Support?

Some edge runtimes don't support TCP connections. Rarely the case anymore.

**Yes** → Continue to step 5 to check transaction requirements.

**No** → Continue to step 6 to check pooling support.

---

### 5. Does Your App Use SQL Transactions?

**Yes** → Use **WebSocket transport** via [`@neondatabase/serverless`](https://github.com/neondatabase/serverless) with `Pool`

WebSocket maintains connection state needed for transactions.

**No** → Use **HTTP transport** via `@neondatabase/serverless`

HTTP is faster for single queries (~3 roundtrips vs ~8 for TCP).

Refer to the [Neon Serverless Driver](https://neon.com/docs/serverless/serverless-driver) docs for more information.

```bash
curl -H "Accept: text/markdown" https://neon.com/docs/serverless/serverless-driver
```

---

### 6. Serverless Environment With Connection Pooling Support?

**Vercel (Fluid Compute)** → Use **TCP with `@vercel/functions`**

Vercel's Fluid compute supports connection pooling. Use `attachDatabasePool` for optimal connection management.

**Cloudflare (with Hyperdrive)** → Use **TCP via Hyperdrive**

Cloudflare Hyperdrive provides connection pooling for Workers. Use `node-postgres` or any native TCP driver for your language (Go, Python, etc.).

**No pooling support (Netlify, Deno Deploy)** → Use `@neondatabase/serverless`

Fall back to the decision in step 5 based on transaction requirements.

---

## Quick Reference Table

| Platform                | TCP Support | Pooling             | Recommended Driver         |
| ----------------------- | ----------- | ------------------- | -------------------------- |
| Vercel (Fluid)          | Yes         | `@vercel/functions` | `pg` (node-postgres)       |
| Cloudflare (Hyperdrive) | Yes         | Hyperdrive          | `pg` (node-postgres)       |
| Cloudflare Workers      | No          | No                  | `@neondatabase/serverless` |
| Netlify Functions       | No          | No                  | `@neondatabase/serverless` |
| Deno Deploy             | No          | No                  | `@neondatabase/serverless` |
| Railway / Render        | Yes         | Built-in            | `pg` (node-postgres)       |
| Client-side (browser)   | No          | N/A                 | `@neondatabase/neon-js`    |

---

## ORM Support

Popular TypeScript/JavaScript ORMs all work with Neon:

- [Drizzle ORM](https://neon.com/docs/guides/drizzle) - Works with `node-postgres`, `postgres.js`, and `@neondatabase/serverless`
- [Kysely](https://neon.com/docs/guides/kysely) - Works with `node-postgres`, `postgres.js`, and `@neondatabase/serverless`
- [Prisma](https://neon.com/docs/guides/prisma) - Works with `node-postgres` and `@neondatabase/serverless`

All ORMs support both TCP drivers and Neon's serverless driver depending on your platform.

```bash
curl -H "Accept: text/markdown" https://neon.com/docs/guides/drizzle
curl -H "Accept: text/markdown" https://neon.com/docs/guides/kysely
curl -H "Accept: text/markdown" https://neon.com/docs/guides/prisma
```

---

## Vercel Fluid + Drizzle Example

Complete database client setup for Vercel with Drizzle ORM and connection pooling:

```typescript
// src/lib/db/client.ts
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Import your schema files
import * as authSchema from "@/lib/auth/schema";
import * as usersSchema from "@/lib/users/schema";

const schema = {
  ...authSchema,
  ...usersSchema,
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
attachDatabasePool(pool);

const db = drizzle({ client: pool, schema });

export { db };
```

**Why `attachDatabasePool`?**

- First request establishes the TCP connection (~8 roundtrips)
- Subsequent requests reuse the connection instantly
- Ensures idle connections close gracefully before function suspension
- Prevents connection leaks in serverless environments

---

## Present Results to User

When helping a user choose their connection method, gather this information:

1. **Deployment platform**: Where will the app run? (Vercel, Cloudflare, Netlify, Railway, browser, etc.)
2. **Runtime type**: Serverless functions, edge functions, or long-running server?
3. **Transaction requirements**: Does the app need SQL transactions?
4. **ORM preference**: Using Drizzle, Kysely, Prisma, or raw SQL?

Then provide:

- The recommended driver/package
- A working code example for their setup
- The correct npm install command

---

## References

- [Neon Serverless Driver](https://neon.com/docs/serverless/serverless-driver)
- [Neon JS Client](https://neon.com/docs/reference/javascript-sdk)
- [Drizzle ORM - Neon Integration](https://orm.drizzle.team/docs/connect-neon)
- [Vercel Connection Pooling Guide](https://vercel.com/guides/connection-pooling-with-functions)
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
