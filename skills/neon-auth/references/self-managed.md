# Self-managed Better Auth

Stay on Managed Better Auth until a required plugin, hook, custom JWT claim, or server option is outside Managed support. See the plugin matrix in `SKILL.md`. Social OAuth for Google, GitHub, and Vercel is supported on Managed Auth and is not a migration reason.

When you do migrate, change the **server**. Replacing only `@neondatabase/auth` with `better-auth/client` while the Managed Auth service is still the identity backend does not add plugins. Do not disable types or inject `plugins` into the Neon wrapper.

## Imports

Managed client (URL first):

```typescript
import { createAuthClient } from "@neondatabase/auth";
```

Self-managed server and client (options object; different packages):

```typescript
import { betterAuth } from "better-auth";
```

```typescript
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  baseURL: "https://auth.example.com",
});
```

React self-managed apps may use `better-auth/react`. Adding a client plugin does not install its server plugin. Fetch the upstream page for the **installed** Better Auth version. Current passkey, API Key, SSO, and MCP plugins ship as separate packages, not only `better-auth/plugins`.

- Installation: https://better-auth.com/docs/installation
- Plugins: https://better-auth.com/docs/concepts/plugins
- Client: https://better-auth.com/docs/concepts/client

## Where it runs

Prefer the existing app host (Next.js route handlers, and similar) when that host already serves `/api/auth`.

Run it in a Neon Function when the auth server should sit next to Postgres, or when the Function itself must be an OAuth authorization server (MCP). That host must pass the `neon-functions` skill: region, claim, `neon.ts` function slug, `neon deploy --env <file>`. Use a module-scope `pg` pool on `DATABASE_URL`. Better Auth accepts a pg pool or an ORM adapter; follow upstream database and schema docs rather than inventing a dump of `neon_auth`.

Hono mount (not a complete auth server). `./auth` is the configured `betterAuth(...)` instance with database, plugins, and schema:

```typescript
import { Hono } from "hono";
import { auth } from "./auth";

const app = new Hono();
app.all("/api/auth/*", (c) => auth.handler(c.req.raw));
export default app;
```

Functions accept a Hono default export. Upstream Hono guide: https://better-auth.com/docs/integrations/hono

## Environment

Self-managed values, not produced by `auth: true`:

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_URL` | Public URL of this Better Auth server |
| `BETTER_AUTH_SECRET` | Signing secret from upstream installation |

When the server is a Function, declare them under `preview.functions.<slug>.env` and pass `neon deploy --env <file>`. Keep `NEON_AUTH_*` for Managed Auth only.

Configure trusted app origins, cookies, and CORS from upstream Hono and cookie docs. Prefer same-origin hosting when it already works.

## MCP OAuth

A third-party MCP client (Cursor, Claude) self-authorizing against your server is this path, not Managed social OAuth. Link `neon-functions` [references/mcp.md](https://neon.com/docs/ai/skills/neon-functions/references/mcp.md) and current https://better-auth.com/docs/plugins/mcp. That Functions sketch can lag upstream package names (`@better-auth/mcp`). Verify imports against the installed version. Do not assume dynamic client registration is on by default.

A self-managed auth server used only for MCP can sit beside an existing Clerk (or Managed) user login. Do not migrate the whole app's identity unless that was the request.

## Migration is not a package swap

There is no documented universal import from Managed `neon_auth` into a self-managed Better Auth schema. Before changing existing state, inventory users, linked accounts, password credentials, sessions, organization membership, application foreign keys / user IDs, callback URLs, and JWT consumers. Prove preservation on an isolated branch. Agree a reauthentication or cutover plan with the owner where anything is unresolved. Do not promise drop-in session continuity.
