# `neon.ts` in depth

## Example `neon.ts`

```typescript
// neon.ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  aiGateway: true,
  buckets: {
    images: {
      access: "private",
    },
  },
  functions: {
    imagegen: {
      name: "AI SDK image agent",
      source: "src/index.ts",
    },
  },
});
```

### Provision services with neon config

Every project ships with Lakebase Postgres; `neon.ts` also declares Auth, Functions, buckets, and the AI Gateway. Realtime is declared under `preview`. Data API is a compatibility toggle, not part of a default backend:

```typescript
// neon.ts
export default defineConfig({
  auth: true,
  functions: {},
  buckets: {},
  aiGateway: true, // see the neon-ai-gateway skill
  preview: { realtime: true }, // see the neon-realtime skill
});
```

Empty `functions` / `buckets` maps are configuration slots, not a deployed API. Do not replace an existing `neon.ts` wholesale with this example.

Reconcile the declaration from the CLI — the Neon equivalent of `terraform status` / `plan` / `apply`:

```bash
neon status          # print the branch's live config (read-only). Alias for `neon config status`.
neon config plan     # dry-run diff of what apply would change (read-only)
neon deploy --env <file>  # apply neon.ts. Pass --env when Function env reads process.env. Alias for `neon config apply`
```

`apply` / `deploy` provision the declared services **and then pull the branch's env into your local env file** (`.env` if it exists, otherwise `.env.local`) (e.g. `Pulled 5 Neon variables into .env.local: DATABASE_URL, …`), so your local env always matches what's deployed.

### Function env and `neon deploy`

`neon deploy` is the preferred full deployment: it applies `neon.ts` (services and functions) to the linked branch. `neon deploy --env <file>` loads that file into `process.env` before evaluating `neon.ts`, then uploads those values as Function env. Use it every time Function env reads `process.env`.

`<file>` is the gitignored file `neon env pull` already writes (`.env` if that file exists, otherwise `.env.local`). Env pull writes Neon-managed vars only (`DATABASE_URL`, `NEON_AI_GATEWAY_*`, …). Add every key under `functions.*.env` to that file yourself, then pass the same path to `--env`.

Declare each Function secret as `{ value: process.env.X, required: true }` (`@neon/config` 1.13.0 and `neon` 9.2.0 or later; `@neon/env` 2.1.0 or later for `parseEnv`). An unset required value fails `neon deploy` and `neon dev` before anything changes, and never fails an import of `neon.ts`. Use `required: false` for an optional value, or `required: "default-branch"` for one only the default branch's deployment needs; when unset, either is removed from the deployment unless it also sets `onUndefined: "skip"`. Never coerce a missing value to an empty string: that uploads `""` and deletes the live key. An empty assignment in the file (`KEY=`) counts as unset. See the `neon-functions` skill for the full table.

Use `neon functions deploy` when you are not applying `neon.ts`: a single function by slug, or a targeted `--env KEY=VALUE` update (that flag is not a file path).

### Branch configuration

Beyond services, `neon.ts` can program what configuration _new_ branches receive via the `branch` property — a function of the branch being evaluated that returns its settings:

```typescript
// neon.ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  branch: (branch) => {
    if (branch.exists) {
      // leave existing branches untouched
      return {};
    }
    if (branch.name.startsWith("dev")) {
      return {
        ttl: "7d", // clean up the branch after 7 days
        postgres: {
          computeSettings: {
            autoscalingLimitMinCu: 0.25, // scale to zero
            autoscalingLimitMaxCu: 1, // keep it cheap
            suspendTimeout: "5m",
          },
        },
      };
    }
    return {};
  },
});
```

The `branch` function receives the target branch (its `name`, whether it `exists` yet, whether it's the default, and more) and returns the tuning you want. Here new `dev-*` branches get a 7-day TTL so they clean themselves up, plus a cheap scale-to-zero compute profile, while existing branches and everything else fall through to the defaults. Because `neon checkout` applies this policy on create, a fresh `dev-*` branch comes up with these settings already in place.

### Type-safe config: invalid setups don't compile

Because `neon.ts` is TypeScript, the compiler catches invalid infrastructure before you ever deploy — and Neon encodes the actual rules (and their fixes) into the types, so the error tells you what to do rather than failing with a useless `Type 'true' is not assignable to type 'never'`. The canonical case, **when the app has chosen Data API for PostgREST/Supabase compatibility**: the Data API verifies requests with Neon Auth by default, so enabling it on its own is a type error _on_ `dataApi`. Do not enable Auth merely to satisfy this error in an app that never needed Data API.

```typescript
export default defineConfig({
  dataApi: true, // type error: `dataApi` (default authProvider 'neon') requires Neon Auth
});
```

The message names both fixes, so pick one:

```typescript
// 1. Enable Neon Auth (the default Data API auth provider):
export default defineConfig({ auth: true, dataApi: true });

// 2. Or verify a third-party IdP instead of Neon Auth:
export default defineConfig({
  dataApi: {
    authProvider: "external",
    jwksUrl: "https://your-idp/.well-known/jwks.json",
  },
});
```

Treat a `neon.ts` type error as the config telling you which services must go together — read the message, it spells out the valid combinations.

See https://neon.com/docs/reference/neon-ts.md for documentation on the `neon.ts` file.
