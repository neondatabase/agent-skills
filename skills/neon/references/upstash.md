# Cache, rate limits, and queues with Upstash

Neon's backend primitives do not include a key-value store or a message queue. When an app needs a cache, rate limiting, or background jobs, pair Neon with [Upstash](https://upstash.com): serverless Redis and QStash, reached over HTTP with no connections to manage, so they work the same from Vercel, Cloudflare, Netlify, and Neon Functions.

| Need                                                                                         | Use                                                |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Cache hot, rarely changing reads (config, categories, feature flags)                         | Upstash Redis, cache-aside                         |
| Per-user or per-API-key rate limits                                                          | `@upstash/ratelimit` on Upstash Redis              |
| Enqueue a background job from app code (emails, webhooks, LLM work), with retries and delays | QStash, delivering to a Neon Function or app route |
| Run on a cron, or when an object lands in a bucket                                           | Neon Function Triggers, not QStash                 |

Keep an existing Redis, cache, or queue the app already uses unless the user asks to change it.

## Setup

Create a Redis database (and copy the QStash token and signing keys) in the [Upstash Console](https://console.upstash.com). The SDKs read these variables:

| Variable                                                | Used by                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`    | `Redis.fromEnv()` in `@upstash/redis` and `@upstash/ratelimit` |
| `QSTASH_TOKEN`                                          | Publishing with `@upstash/qstash`                              |
| `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | Verifying QStash deliveries                                    |

In a Neon Function, add each key under `functions.<name>.env` in `neon.ts`, put the values in your env file, and deploy with `neon deploy --env <file>` (see [Function env and `neon deploy`](../SKILL.md#function-env-and-neon-deploy)).

**Scope keys by branch.** A Neon branch gets its own database, but an Upstash database is shared by every branch that points at it. Prefix keys with `NEON_BRANCH` (the branch **name**, injected into Functions and emitted by `neon env pull`) so a preview branch never reads another branch's cached rows or spends its rate-limit budget.

## Cache

Cache-aside: read from Redis, fall back to Postgres on a miss, and write the result back with a TTL. Cached reads never reach Postgres, which cuts egress and lets an idle compute stay scaled to zero.

```typescript
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const prefix = `myapp:${process.env.NEON_BRANCH ?? "local"}`;
const categoriesKey = `${prefix}:categories:v1`;

export async function getCategories() {
  const cached = await redis.get<Category[]>(categoriesKey);
  if (cached !== null) return cached;

  const rows = await db.select().from(categories);
  await redis.set(categoriesKey, rows, { ex: 300 }); // 5-minute TTL
  return rows;
}

export async function renameCategory(id: number, name: string) {
  await db.update(categories).set({ name }).where(eq(categories.id, id));
  await redis.del(categoriesKey); // invalidate after the write commits
}
```

- Cache only data that is read far more often than it changes. Always set a TTL, so a missed invalidation heals itself.
- `@upstash/redis` serializes JSON for you; bump the `:v1` suffix when the cached shape changes.
- Never cache per-user or authorization-dependent rows under a shared key.

## Rate limits

Limit by a **verified** principal (user id, org id, API-key hash), never by a caller-supplied id or `X-Forwarded-For`.

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const limiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: `myapp:api:${process.env.NEON_BRANCH ?? "local"}`,
});

const { success, reset } = await limiter.limit(userId);
if (!success) {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return new Response("Too Many Requests", {
    status: 429,
    headers: { "Retry-After": String(retryAfter) },
  });
}
```

For a Neon Function, the `neon-functions` skill's `references/production-hardening.md` has the hardened version: timeouts, fail-closed on store errors, and `waitUntil(result.pending)`.

## Queues

QStash accepts a message over HTTP and delivers it as a POST to a public URL, retrying on non-2xx responses. Neon Functions have public HTTPS URLs, so a Function makes a natural worker. The app enqueues and returns immediately:

```typescript
import { Client } from "@upstash/qstash";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

await qstash.publishJSON({
  url: `${process.env.WORKER_URL}/jobs/welcome-email`,
  body: { userId },
  retries: 3,
  delay: "10s",
});
```

The worker verifies the signature before doing any work. Anyone can POST to a Function URL, so an unverified job endpoint is an open door:

```typescript
import { Hono } from "hono";
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const app = new Hono();

app.post("/jobs/welcome-email", async (c) => {
  const body = await c.req.text(); // verify the raw body, before parsing
  const valid = await receiver
    .verify({ signature: c.req.header("Upstash-Signature") ?? "", body })
    .catch(() => false);
  if (!valid) return c.text("Invalid signature", 401);

  const { userId } = JSON.parse(body);
  await sendWelcomeEmail(userId);
  return c.text("ok");
});

export default app;
```

- Make handlers idempotent: a retry can redeliver a job that partly ran. Key side effects on the `Upstash-Message-Id` header or a job id in the body.
- Return a non-2xx status to have QStash retry; messages that exhaust their retries land in the QStash dead-letter queue.
- For multi-step jobs that must survive failures between steps, use [Upstash Workflow](https://upstash.com/docs/workflow) on top of QStash.

Docs: [Upstash Redis](https://upstash.com/docs/redis), [Ratelimit](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview), [QStash](https://upstash.com/docs/qstash).
