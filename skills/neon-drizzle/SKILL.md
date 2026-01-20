---
name: neon-drizzle
description: Use this skill when integrating Neon (serverless Postgres) with Drizzle ORM. Covers connection setup (TCP with node-postgres, HTTP, WebSocket), schema definition, migrations, transactions, and query patterns.
---

# Neon and Drizzle Integration

This guide covers the specific integration patterns, configurations, and optimizations for using **Drizzle ORM** with **Neon** Postgres.

## Choosing the Right Driver

Drizzle ORM works with multiple Postgres drivers. Choose based on your deployment platform:

| Platform                | TCP Support | Pooling             | Recommended Driver         |
| ----------------------- | ----------- | ------------------- | -------------------------- |
| Vercel (Fluid)          | Yes         | `@vercel/functions` | `pg` (node-postgres)       |
| Cloudflare (Hyperdrive) | Yes         | Hyperdrive          | `pg` (node-postgres)       |
| Cloudflare Workers      | No          | No                  | `@neondatabase/serverless` |
| Netlify Functions       | No          | No                  | `@neondatabase/serverless` |
| Deno Deploy             | No          | No                  | `@neondatabase/serverless` |
| Railway / Render        | Yes         | Built-in            | `pg` (node-postgres)       |

**Decision Guide:**

1. **Long-running server?** (Railway, Render, traditional VPS) → Use **TCP with `pg` (node-postgres)**
2. **Vercel Fluid compute?** → Use **TCP with `pg`** + `@vercel/functions` for connection pooling
3. **Cloudflare with Hyperdrive?** → Use **TCP with `pg`** via Hyperdrive
4. **Edge without TCP?** (Cloudflare Workers, Netlify, Deno Deploy) → Use **`@neondatabase/serverless`**
   - Need transactions? → WebSocket transport
   - Single queries only? → HTTP transport (faster, ~3 roundtrips vs ~8)

## Neon Connection String

Store your connection string in an environment file (`.env`, `.env.local`):

```text
DATABASE_URL="postgresql://[user]:[password]@[neon_hostname]/[dbname]?sslmode=require&channel_binding=require"
```

## Connection Setup

### 1. TCP with node-postgres (Long-Running Servers)

Best for Railway, Render, traditional VPS, or any long-running Node.js server. Maintains persistent TCP connections with built-in pooling.

**Dependencies:**

```bash
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg dotenv
```

**Setup:**

```typescript
// src/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool });
```

### 2. Vercel Fluid Compute with Connection Pooling

Vercel's Fluid compute supports connection pooling. Use `attachDatabasePool` for optimal connection management.

**Dependencies:**

```bash
npm install drizzle-orm pg @vercel/functions
npm install -D drizzle-kit @types/pg
```

**Setup:**

```typescript
// src/db.ts
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Import your schema files
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema });
```

**Why `attachDatabasePool`?**

- First request establishes the TCP connection (~8 roundtrips)
- Subsequent requests reuse the connection instantly
- Ensures idle connections close gracefully before function suspension
- Prevents connection leaks in serverless environments

### 3. HTTP Adapter (Edge Without TCP)

Ideal for edge runtimes without TCP support (Cloudflare Workers, Netlify Edge, Deno Deploy). Uses `fetch` for each query, resulting in very low latency for single operations (~3 roundtrips).

**Dependencies:**

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit dotenv
```

**Setup:**

```typescript
// src/db.ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql);
```

**Note:** HTTP transport does not support interactive transactions. Use WebSocket if you need transactions.

### 4. WebSocket Adapter (Edge with Transactions)

Use when you need transaction support in edge environments without TCP. Maintains a persistent WebSocket connection.

**Dependencies:**

```bash
npm install drizzle-orm @neondatabase/serverless ws
npm install -D drizzle-kit dotenv @types/ws
```

The `ws` package is required for persistent WebSocket connections in Node.js environments older than v22.

**Setup:**

```typescript
// src/db.ts
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { config } from "dotenv";
import ws from "ws";

config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

// Required for Node.js < v22
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);
```

## Drizzle Config

Configure `drizzle.config.ts` for schema and migrations:

```typescript
// drizzle.config.ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Migrations

### Generate Migrations

```bash
npx drizzle-kit generate
```

### Apply Migrations

```bash
npx drizzle-kit migrate
```

## Schema Definition

Use Postgres-specific types from `drizzle-orm/pg-core`:

```typescript
// src/schema.ts
import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Export types for type safety
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Post = typeof postsTable.$inferSelect;
export type NewPost = typeof postsTable.$inferInsert;
```

## Query Patterns

### Efficient Queries for Serverless

```typescript
import { db } from "../db";
import { sql } from "drizzle-orm";
import { usersTable } from "../schema";

// Batch inserts are more efficient than individual inserts
export async function batchInsertUsers(users: NewUser[]) {
  return db.insert(usersTable).values(users).returning();
}

// Use prepared statements for repeated queries
export const getUsersByRolePrepared = db
  .select()
  .from(usersTable)
  .where(sql`${usersTable.role} = $1`)
  .prepare("get_users_by_role");

// Usage: getUsersByRolePrepared.execute(['admin'])
```

### Transaction Handling

```typescript
import { db } from "../db";
import { usersTable, postsTable } from "../schema";

export async function createUserWithPosts(user: NewUser, posts: NewPost[]) {
  return await db.transaction(async (tx) => {
    const [newUser] = await tx.insert(usersTable).values(user).returning();

    if (posts.length > 0) {
      await tx.insert(postsTable).values(
        posts.map((post) => ({
          ...post,
          userId: newUser.id,
        })),
      );
    }

    return newUser;
  });
}
```

## Working with Neon Branches

Use environment variables to connect to different branches:

```typescript
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const getBranchUrl = () => {
  const env = process.env.NODE_ENV;
  if (env === "development") {
    return process.env.DEV_DATABASE_URL;
  } else if (env === "test") {
    return process.env.TEST_DATABASE_URL;
  }
  return process.env.DATABASE_URL;
};

const sql = neon(getBranchUrl()!);
export const db = drizzle({ client: sql });
```

## Error Handling

```typescript
import { db } from "../db";
import { usersTable } from "../schema";

export async function safeNeonOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (error.message?.includes("connection pool timeout")) {
      console.error("Neon connection pool timeout");
    }
    throw error;
  }
}

// Usage
export async function getUserSafely(id: number) {
  return safeNeonOperation(() =>
    db.select().from(usersTable).where(eq(usersTable.id, id)),
  );
}
```

## Best Practices

1. **Connection Management**
   - **Long-running servers**: Use `pg` (node-postgres) with connection pooling
   - **Vercel Fluid**: Use `pg` with `@vercel/functions` `attachDatabasePool`
   - **Edge without TCP**: Use `@neondatabase/serverless` (HTTP for single queries, WebSocket for transactions)
   - Keep connection times short for serverless functions

2. **Neon Features**
   - Utilize Neon branching for development and testing
   - Consider Neon's auto-scaling for database design

3. **Query Optimization**
   - Batch operations when possible
   - Use prepared statements for repeated queries
   - Optimize complex joins to minimize data transfer

4. **Schema Design**
   - Leverage Postgres-specific features supported by Neon
   - Use appropriate indexes for your query patterns

## Related Skills

- **choose-connection-method** - Detailed guidance on selecting the right driver for your platform
- **neon-serverless** - Direct database connections without ORM
- **neon-api** - Managing Neon projects and branches programmatically
