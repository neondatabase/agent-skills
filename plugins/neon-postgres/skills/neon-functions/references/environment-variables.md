# Environment variables and function URLs on Neon Functions

## Environment Variables

Neon injects branch-scoped connection strings and service URLs at runtime — you don't declare these or pass them at deploy time:

| Variable                    | Notes                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEON_BRANCH`               | The branch **name** (e.g. `main`, `preview/foo`). Injected on every branch, including the default.                                                                 |
| `NEON_BRANCH_ID`            | The branch **id** (`br-…`). Injected on every branch.                                                                                                              |
| `NEON_FUNCTION_HOST_SUFFIX` | The hostname suffix every function on the branch shares (`.compute.c-2.us-east-2.aws.neon.tech`). See [How to get the function URL](#how-to-get-the-function-url). |
| `DATABASE_URL`              | Pooled connection string. Use for most queries. Present only if the branch has Postgres.                                                                           |
| `DATABASE_URL_UNPOOLED`     | Direct connection. Use for migrations, `LISTEN`/`NOTIFY`, multi-round-trip transactions.                                                                           |
| `NEON_AUTH_BASE_URL`        | Present when Neon Auth is enabled on the branch.                                                                                                                   |
| `NEON_AUTH_JWKS_URL`        | Present when Neon Auth is enabled on the branch. JWKS for verifying Managed Auth JWTs.                                                                             |
| `NEON_DATA_API_URL`         | Present when the Data API is enabled on the branch.                                                                                                                |

Object storage (`AWS_*`) and AI Gateway (`NEON_AI_GATEWAY_*`) vars are also injected when those services are declared — see the `neon-object-storage` and `neon-ai-gateway` skills.

`neon env pull` / `neon-env run` / `neon dev` emit `NEON_BRANCH`, `NEON_BRANCH_ID`, `NEON_FUNCTION_HOST_SUFFIX` (and the connection strings) into your local dev environment too, so local runs mirror the deployed runtime.

**Your own secrets** are per-deployment. Preferred path: declare them in `neon.ts` and run `neon deploy --env <file>`. `<file>` is the gitignored file env pull already writes (`.env` if that file exists, otherwise `.env.local`). Env pull writes Neon-managed vars only; add Function secrets to that file. Declare each one with both `value` and `required` (needs `@neon/config` 1.13.0 and `neon` 9.2.0 or later, and `@neon/env` 2.1.0 or later where the function calls `parseEnv`; older `parseEnv` treats every declared key as required):

```typescript
functions: {
  todos: {
    name: "todo api",
    source: "src/index.ts",
    env: {
      RESEND_API_KEY: { value: process.env.RESEND_API_KEY, required: true },
      SENTRY_DSN: { value: process.env.SENTRY_DSN, required: "default-branch" },
      LOG_LEVEL: "info",
    },
  },
}
```

| `required` | Unset deploying the default branch | Unset deploying another branch | Unset in `neon dev` | `parseEnv(config, slug).function` |
| --- | --- | --- | --- | --- |
| `true` | fails before any change | fails before any change | fails before any function starts | `string` |
| `"default-branch"` | fails before any change | removed from the deployment | runs without it | `string \| undefined` |
| `false` | removed from the deployment | removed from the deployment | runs without it | `string \| undefined` |

An undefined or empty value counts as unset; put a fallback in `value` (`process.env.X ?? "1"`). `"default-branch"` is the branch Neon marks as default, not a branch name. Add `onUndefined: "skip"` to a `required: false` or `"default-branch"` variable to keep its deployed value instead of removing it, for a value set with `neon functions deploy --env`. Keys `neon.ts` does not declare are left alone.

Prefer a declaration over a string such as `process.env.X!`. A string is validated wherever `neon.ts` is imported, so a function that calls `parseEnv(config, "<slug>")` fails to load when another function's secret is missing from its runtime. A declaration is checked only when a command needs its value.

`neon functions deploy --env KEY=VALUE` is the manual path (repeatable; `--env KEY=` deletes a key; unmentioned keys carry over). Use it for a targeted env update, not a full `neon.ts` apply.

Load Function secrets into the same file env pull wrote, then `neon deploy --env <file>`. Pull the branch's Neon-managed vars onto disk for local dev with `neon env pull` (`link`/`checkout` do this automatically; pass `--no-env-pull` to skip and use `neon-env run -- <cmd>` for runtime injection). Limits: ≤1,000 vars, ≤64 KiB total, and the `NEON_` prefix is reserved.

## How to get the function URL

A function answers at `https://<NEON_BRANCH_ID>-<slug><NEON_FUNCTION_HOST_SUFFIX>`, for example `https://br-cool-lab-a1b2c3d4-todos.compute.c-2.us-east-2.aws.neon.tech`. Each branch has its own URL.

**From a terminal:** `neon functions get <slug>` prints it as `invocation_url`. `neon deploy` prints it for each function it deploys.

**From code** (another function, a script, or an app after `neon env pull`): call `functionBaseUrl(slug)` from `@neon/env` (2.0.0 or later). It returns the base URL with no trailing slash:

```typescript
import { functionBaseUrl } from "@neon/env";

const res = await fetch(`${functionBaseUrl("todos")}/api/todos`);
```

| Where the code runs                        | `functionBaseUrl("todos")` returns                  |
| ------------------------------------------ | --------------------------------------------------- |
| A deployed function on the branch          | `https://<branch_id>-todos.compute.…` (runtime env) |
| An app or script after `neon env pull`     | the same URL, from the pulled env                   |
| `neon dev`, when it serves `todos`         | `http://localhost:<port>`                           |
| `neon dev`, when it does not serve `todos` | the deployed URL on the linked branch               |

It reads `process.env` by default. Pass the two variables explicitly when they come from elsewhere: `functionBaseUrl("todos", { NEON_BRANCH_ID, NEON_FUNCTION_HOST_SUFFIX })`. It throws when either variable is missing; run `neon env pull` (or `neon env pull -s functions` for only the branch variables) to fix that locally. The function does not have to be deployed for the URL to resolve, but the request fails until it is.

Browser code has no access to these variables. Build the URL on the server with `functionBaseUrl` and pass it to the client.

Older releases wrote one `NEON_FUNCTION_<SLUG>_BASE_URL` per function and exposed `env.functions.<slug>.baseUrl`. `neon` 9 and `@neon/env` 2 removed both, and `neon env pull` deletes those lines. Replace them with `functionBaseUrl("<slug>")`.

## Validate only the variables a function needs

`parseEnv(config)` requires _every_ variable the config implies. A function that only talks to Postgres over the pooled URL can scope it to just that key — `parseEnv` then validates and returns only what you asked for (the keys autocomplete from your `neon.ts`):

```typescript
const { postgres } = parseEnv(config, ["DATABASE_URL"]); // not the unpooled URL, auth, etc.
const pool = new Pool({ connectionString: postgres.databaseUrl, max: 5 });
attachDatabasePool(pool);
```
