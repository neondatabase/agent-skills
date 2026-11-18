# WebSocket servers on Neon Functions

## WebSocket Servers

A WebSocket server is the canonical Functions workload: a long-running handler holds connections open in-process, with no external state store needed to keep a stream coherent. The connection stays alive as long as bytes flow (15-minute heartbeat, see [Timeouts](runtime-limits.md#timeouts-and-runtime-limits)).

**Upgrade from inside `fetch`.** Call `upgradeWebSocket(request)` from [`@neon/functions`](https://www.npmjs.com/package/@neon/functions) and return the response it gives you. Hono apps use the same primitive via `@neon/functions/hono` (see [Hono](#hono) below). There is one entrypoint and no WebSocket dependency to install:

```typescript
import { upgradeWebSocket } from "@neon/functions";

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("expected a websocket upgrade", { status: 426 });
    }

    const { socket, response } = upgradeWebSocket(req);
    socket.addEventListener("message", (event) => socket.send(event.data));
    return response;
  },
};
```

`socket` is a standard [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket), so `addEventListener` and the `onopen`/`onmessage`/`onclose`/`onerror` properties both work. It is still `CONNECTING` when you get it — the runtime writes the `101` only once your handler returns `response`, and the socket opens then.

Three rules that matter:

- **Return `response` unchanged.** A `101` can't be built as a plain `Response` (the fetch spec caps constructed responses at 200–599), so the runtime hands back an object carrying the pending upgrade. `clone()`, or rebuilding it with `new Response(res.body, res)` as response-rewriting middleware does, discards the upgrade and fails the request.
- **Refuse a handshake by returning an ordinary `Response`.** Return a `401`, `403`, or `404` from `fetch`, before you upgrade, to gate a socket. A browser client can't read why a handshake was refused; it sees only a generic connection failure, not your status or body. Refuse to keep clients out, but send any detail the client needs over a separate authenticated request.
- **`binaryType` defaults to `"arraybuffer"`**, not the browser's `"blob"`. `event.data` is a `string` for text frames and an `ArrayBuffer` for binary ones, so branch on `typeof`.

**With auth.** Browsers can't set headers on a WebSocket, so authenticate with a `?token=` query param (verify it the same way as the [agent backend](agent-backend.md#functions-as-an-agent-backend-nextjs-and-similar-frameworks): `jwtVerify` against your JWKS) and refuse before upgrading:

```typescript
// src/index.ts
import { upgradeWebSocket } from "@neon/functions";

const clients = new Set<WebSocket>();

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket endpoint — connect with ?token=<jwt>");
    }

    const url = new URL(request.url);
    const identity = await verifyToken(url.searchParams.get("token"));
    if (!identity) return new Response("unauthorized", { status: 401 });

    const { socket, response } = upgradeWebSocket(request);
    clients.add(socket);
    socket.addEventListener("close", () => clients.delete(socket));
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      persist(identity.id, event.data); // fan out to every isolate — see below
    });
    return response;
  },
};
```

**Subprotocols.** Pass `{ protocol }` to select one the client offered; it is echoed in `Sec-WebSocket-Protocol` and exposed as `socket.protocol`. Selecting one the client did not offer throws a `TypeError`. Omit it and no protocol is negotiated. No extensions are negotiated either — `socket.extensions` is always `""` and `permessage-deflate` is not available.

### Hono

**Hono.** Use `upgradeWebSocket` from `@neon/functions/hono` — the same primitive as Hono's own WebSocket helper, with no `ws` dependency and not the deprecated `@hono/node-ws`. Auth is ordinary middleware; gate upgrade requests before `next()`:

```typescript
// src/index.ts
import { Hono } from "hono";
import { upgradeWebSocket } from "@neon/functions/hono";

const clients = new Set<WebSocket>();

const app = new Hono<{ Variables: { userId: string } }>();

app.use("/ws", async (c, next) => {
  const identity = await verifyToken(c.req.query("token"));
  if (!identity) return c.text("Unauthorized", 401);
  c.set("userId", identity.id);
  await next();
});

app.get(
  "/ws",
  upgradeWebSocket((c) => ({
    onOpen(_event, ws) {
      clients.add(ws.raw);
      ws.send("welcome");
    },
    onClose(_event, ws) {
      clients.delete(ws.raw);
    },
    onMessage(event, ws) {
      ws.send(`echo: ${event.data}`);
    },
  })),
);

export default app;
```

Connect from the browser with the function's `wss://` URL (from `neon functions get <slug>`), for example `new WebSocket("wss://<branch>-<slug>.compute.<region>.aws.neon.tech/ws?token=<jwt>")`. Reconnect on close — isolates are evictable and idle connections may be terminated after 15 minutes.

Do not put `cors()` on the upgrade route, and do not read `c.res` before `await next()` or call `c.header()` after it — both rebuild the `101` and break the upgrade. See `@neon/functions` README for the full middleware table.

### Heartbeat (keep the socket alive)

A connection stays open **only while bytes flow**: Neon evicts a silent stream after 15 minutes ([Timeouts and Runtime Limits](runtime-limits.md#timeouts-and-runtime-limits)), and intermediary proxies / load balancers are usually far stricter (often tens of seconds). Don't rely on the app being chatty enough — send a periodic keepalive from the server so the socket never goes quiet.

The standard `WebSocket` interface has no `ping()`, so send an application-level message the client filters out:

```typescript
const HEARTBEAT_MS = 25_000; // comfortably under proxy idle timeouts

const beat = setInterval(() => {
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) socket.send('{"type":"ping"}');
  }
}, HEARTBEAT_MS);
beat.unref?.();
```

The client skips these when handling messages. There is no protocol-level shortcut here: the standard `WebSocket` from `upgradeWebSocket` has no `ping()`, and a browser can't send ping frames from JavaScript, so an application-level message is the only keepalive a browser client can use. (A Node `ws` client can send ping frames, and the server auto-replies with a pong, but a browser can't.)

### Fan-out across isolates (do not skip this)

Under load the runtime runs **several isolates in parallel, each with its own copy of module state** — so each isolate has its own `clients` set. Broadcasting only to that local set means a client on isolate A never sees an event produced on isolate B, and the feed silently fractures. It's easy to miss: `neon dev` runs a single process (one isolate), so in-process broadcast always _looks_ fine locally but breaks in production, where concurrent connections spread across many isolates.

If the data is database rows (live dashboards, feeds, chat over stored messages), use Neon Realtime (the `neon-realtime` skill) instead of hand-rolling fan-out. Using Realtime does not prevent your database from scaling to zero. The strategies below are for push that doesn't come from database rows (presence, typing, LLM streams), and the fallback where Realtime isn't available, such as on Claimable projects until they're claimed.

Module state doesn't survive eviction anyway, so **Postgres is the shared source of truth**. Pick a fan-out strategy. In every snippet below, `pool` is a pooled `pg` client and `clients` is this isolate's `Set` of live connections.

**1. Poll Postgres — the default, and it keeps Scale to Zero.** Each isolate re-reads the shared state (or rows past a cursor) on a short interval and pushes changes to its own clients. One query per isolate per tick (not per client), and none when the isolate has no clients — so an idle compute still suspends.

```typescript
let lastId = "0"; // bigint id, so a string
let polling = false;

async function poll() {
  if (polling || clients.size === 0) return; // guard overlap; no clients → no query → compute can scale to zero
  polling = true;
  try {
    const { rows } = await pool.query(
      "SELECT id, payload FROM events WHERE id > $1 ORDER BY id",
      [lastId],
    );
    for (const { id, payload } of rows) {
      lastId = id;
      for (const socket of clients) {
        if (socket.readyState === socket.OPEN) socket.send(payload);
      }
    }
  } catch (err) {
    console.error("[poll]", err);
  } finally {
    polling = false;
  }
}

// Seed from the latest id so a fresh isolate sends only new rows, not the whole table, then poll.
pool
  .query("SELECT coalesce(max(id), 0)::text AS id FROM events")
  .then((seed) => {
    lastId = seed.rows[0].id;
  })
  .catch((err) => console.error("[seed]", err))
  .finally(() => setInterval(poll, 1000).unref?.());
```

- **Latency:** up to the interval (~1s).
- **Scaling:** database load grows with the number of live isolates, not clients. Keep the cursor on an indexed `serial`/`bigserial` PK and the interval sane.
- **Scale to Zero:** ✅ preserved — polling stops when no clients are connected, so the compute suspends on its normal timer.
- **Ordering:** `WHERE id > cursor` can skip a row that commits out of sequence: a transaction that took a lower id but commits after a higher one is already behind the cursor, so the poll never returns it. For a broadcast feed occasional loss is usually fine; when you need every row, use `LISTEN`/`NOTIFY` or poll by `created_at` with a small overlap window and dedupe by id.

**2. `LISTEN`/`NOTIFY` — lowest latency, but requires disabling Scale to Zero.** Each isolate `LISTEN`s on a channel over a dedicated **unpooled** connection; broadcasting is `NOTIFY`, so every isolate (including the sender's) re-pushes to its sockets. Near-instant — but the listener holds an idle connection that **does not count as active**, so [Scale to Zero](https://neon.com/docs/introduction/scale-to-zero) suspends the compute and drops it, silently killing the feed. Only use it on an **always-on** compute (Scale to Zero disabled — a paid-plan setting: `neon postgres computes update <compute-id> --suspend-timeout -1`).

```typescript
import { attachDatabasePool } from "@neon/functions";
import { Pool, Client } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
attachDatabasePool(pool);
const CHANNEL = "chat_events";

// One dedicated DIRECT connection per isolate, just to receive events.
// Use DATABASE_URL_UNPOOLED — LISTEN needs a real session, not a pooled one.
// Don't call attachDatabasePool here: it would silence the idle drop that killed the feed.
// The error listener keeps the process alive; reconnect the client on error in production (omitted here).
const listener = new Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED,
});
listener.on("error", (err) => {
  console.error(err);
});
listener.connect().then(() => listener.query(`LISTEN ${CHANNEL}`));
listener.on("notification", (msg) => {
  if (!msg.payload) return;
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) socket.send(msg.payload);
  }
});

// Broadcast by NOTIFYing through the pool — every isolate's listener fires.
function broadcast(event: unknown) {
  return pool.query("SELECT pg_notify($1, $2)", [
    CHANNEL,
    JSON.stringify(event),
  ]);
}
```

**3. External pub/sub (e.g. [Upstash](https://upstash.com) Redis) — best at scale.** For high fan-out, sub-second latency at large connection counts, or multi-region, publish/subscribe through a dedicated broker. Highest throughput, and it doesn't touch Postgres or block Scale to Zero — at the cost of another service to run.

**Rule of thumb:** for database rows, use **Neon Realtime**. Otherwise start with **polling** (works with Scale to Zero, no extra infra); switch to `LISTEN`/`NOTIFY` only on always-on compute that needs sub-second latency; move to Redis when fan-out outgrows Postgres.

### Client must reconnect

Idle functions are evicted (and isolates restart for operational reasons), so a client's socket **will** drop — treat reconnection as normal, not exceptional. Reconnect with exponential backoff, capped, and **re-mint a fresh token on every attempt** (tokens are short-lived, so a stale one fails the `upgrade` auth check):

```typescript
let closed = false,
  retry = 0,
  timer: ReturnType<typeof setTimeout>;

async function connect() {
  if (closed) return;
  const token = await getToken(); // re-mint each attempt; short-lived
  const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
  ws.onopen = () => {
    retry = 0; // reset backoff on success
  };
  ws.onmessage = (e) => {
    /* apply the event */
  };
  ws.onclose = () => {
    if (!closed)
      timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
  };
  ws.onerror = () => ws.close(); // let onclose drive the retry
}
connect();
```

Together — `upgradeWebSocket` inside `fetch`, JWT auth over `?token=`, cross-isolate fan-out, and client backoff — these compose into a complete WebSocket backend on a single function, for push that doesn't come from database rows (presence, typing, LLM streams) or where Realtime isn't available. For persisted chat, feeds, and other live UIs over database rows, use Neon Realtime (the `neon-realtime` skill).
