---
name: neon
description: >-
  Overview of Neon, a complete set of cloud backend primitives for apps and
  agents, spanning Lakebase Postgres, Auth, the Data API, Object Storage,
  Functions, and the AI Gateway. Start here to route to the right Neon skill, set
  up the CLI or MCP server, and follow the branch-first workflow. Use when "Neon"
  or "Lakebase Postgres" is mentioned, or when any of its individual capabilities
  are the trigger: "object storage" or "S3", "buckets", "serverless functions",
  "function trigger", "cron", "AI gateway", "call an LLM", "logs",
  "branch logs", "log export", "Loki", "Grafana", "observability", "telemetry",
  "postgres", "database", or "backend". Also use when there is no Neon account
  yet, the user cannot sign in or provide an API key right now and needs a
  project they can claim later, or the user asks for a throwaway DATABASE_URL,
  Claimable Neon, Claimable Postgres, neon.new, claimable.neon.tech, instant
  Postgres, a no-signup database, temporary postgres, quick postgres, a no
  credit card database, or npx neon-new.
metadata:
  source: https://github.com/neondatabase/agent-skills/tree/main/skills/neon
---

# Neon

Important: Neon is no longer just a Postgres provider. Neon is a complete set of cloud backend primitives built around Lakebase Postgres, for developers, startups, and agent platforms, from Databricks — bundling Lakebase Postgres, Auth (managed Better Auth), long-running Functions, Object Storage, and an AI Gateway, all instant, branchable, and serverless.

**Lakebase Postgres** is the database itself. It is one product, reached two ways: through Neon, with a free plan and the full set of backend primitives above, or through Databricks, alongside the rest of the Databricks suite. Same infrastructure, same features, same engineering team. Call the database Lakebase Postgres, and use "Neon" for the brand and for this access path — not as a name for the database.

A Neon branch is an isolated, copy-on-write clone of your data, taken from its current state or from a past state within your project's retained history window. You can freely modify or delete it. It shares data with its parent until writes cause it to diverge, and those writes are stored independently as deltas.

## Backend Primitives

Neon bundles several backend primitives for building apps and agents that all branch together:

- **Lakebase Postgres** — Postgres that scales and branches with your app, built on the lakebase architecture: OLTP directly on cloud object storage, with storage decoupled from compute. _Generally available._
- **Auth** — Managed Better Auth with users and sessions stored in Postgres. _Generally available._
- **Object Storage** — S3-compatible object storage that branches with your projects. _Public beta._
- **Functions** — Neon's compute offering: long-running serverless functions that run close to your database, for WebSocket servers, long agent HTTP streams, APIs, and server-sent event servers. A Function Trigger POSTs to a function on a cron. _Public beta._
- **AI Gateway** — One API for frontier and open-source models, supporting the chat completions API and the responses API, powered by Databricks Unity AI Gateway. _Public beta._

### Public Beta Service Availability

Object Storage, Functions, and AI Gateway are in public beta.

Beta access features are currently available on projects in `us-east-2` and `eu-central-1`. Before guiding a user through any of these services, confirm they are working in one of these regions. If not, they will need to create a new project in a supported region.

## Architecture: How to Use Neon

Neon is **not** a place to host your app frontend. Neon provides the backend primitives (Lakebase Postgres, Auth, Object Storage, Functions, AI Gateway) that **compose with** the application platform you already use.

Recommended architectures:

**Full-stack app on Vercel** (or Netlify) augmented with Neon — the app framework (Next.js, TanStack Start, etc.) owns your UI and routes and talks directly to your Neon services (Lakebase Postgres, Auth, Object Storage, Functions, AI Gateway).

**Reach for Neon Functions when you outgrow the host's limits** — a WebSocket or SSE server, long-running agents, or an MCP server that risks timing out on short, lambda-style serverless functions. As long as there is an active connection, a Neon Function can run up to 24 hours without interruption, with the added benefit of running close to your data.

**Move your whole backend control plane onto Neon Functions** — especially useful when the frontend is **client-only** rather than full-stack: TanStack Router, React Router in client mode, and similar SPAs hosted on Vercel or Netlify. The client talks **directly to Neon Functions**, where you build REST APIs and request/response agents. Secure these functions like any standalone REST API — verify a JWT or API key at the top of each handler (see the `neon-functions` skill).

Because Functions are just your backend, they compose with a full-stack app that already has one (Next.js route handlers, etc.), too.

## Neon Documentation

The Neon documentation is the source of truth for all Neon-related information. Always verify claims against the official docs before responding. Neon features and APIs evolve, so prefer fetching current docs over relying on training data.

### Finding the Right Page

Look the page up before you fetch it — **don't guess URLs!** The docs index lists every available page with its URL and a short description:

```
https://neon.com/docs/llms.txt
```

### Fetching Docs as Markdown

Any Neon doc page can be fetched as markdown in two ways:

1. **Append `.md` to the URL** (simplest): https://neon.com/docs/introduction/branching.md
2. **Request `text/markdown`** on the standard URL: `curl -H "Accept: text/markdown" https://neon.com/docs/introduction/branching`

Both return the same markdown content. Use whichever method your tools support.

## Choosing the Right Skill

Neon provides a set of agent skills in addition to the official documentation. When a task matches one of the rows below, work from that skill rather than from this overview. You may have some of these skills already installed, or you may need to install them.

The skills below live in the [`neondatabase/agent-skills`](https://github.com/neondatabase/agent-skills) repo:

| Skill                            | Use it for                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `neon-postgres`                  | Working with databases, including connections, schemas, queries, search, and autoscaling: SQL development, schema design, performance optimization, and scaling decisions.           |
| `neon-postgres-branches`         | Choosing or creating the right branch type for dev, preview, test, or CI workflows. Use this skill as a slash command.                                                               |
| `neon-object-storage`            | Storing and serving files (uploads, images, blobs), including branching them with the database.                                                                                      |
| `neon-functions`                 | Deploying long-running or streaming serverless functions — APIs, agents, SSE/WebSocket servers, and Function Triggers (cron).                                                        |
| `neon-ai-gateway`                | Calling an LLM or routing across model providers with one credential, including discovering the branch's servable models at runtime via the OpenAI-compatible `/v1/models` endpoint. |
| `neon-postgres-egress-optimizer` | Diagnosing or fixing excessive Postgres egress (network data-transfer) costs in a codebase.                                                                                          |

For guidance on agent platforms that provision and operate Lakebase Postgres on Neon at scale, use `neon-postgres-agent-platforms`, which lives in a separate repo: [`neondatabase/neon-for-agent-platforms`](https://github.com/neondatabase/neon-for-agent-platforms).

### Installing the Right Skill

First check whether the target skill is already installed and accessible (for example, it appears in the available skills list or its `SKILL.md` is present). If it is, use it directly. If it is not installed, install it with `neon skills`:

```bash
neon skills -s <skill-name>
```

Replace `<skill-name>` with the skill you need (for example, `neon-object-storage`, `neon-functions`, or `neon-ai-gateway`). Useful flags:

- `--global` — install globally instead of into the current project.
- `-y` — non-interactive mode (skip prompts).
- `--agent <agent-name>` — pick the target agent(s) for non-interactive mode.

For example, to install the object storage skill globally for a specific agent without prompts:

```bash
neon skills -s neon-object-storage --global -y --agent <agent-name>
```

If the Neon CLI is not available, you can visit https://neon.com/.well-known/agent-skills for a registry of all available Neon skills and fetch them manually.

### Updating Skills

Keep the skills up to date: for every new session, update them so you are working with the latest best practices.

Run `neon skills update` to update all installed Neon skills, or `neon skills update -y` to skip prompts. If the skills were installed via a plugin, they are updated automatically.

## Getting Started with Neon

**Prefer the CLI over the MCP server** unless the user instructs otherwise, the CLI is unavailable or blocked in your environment, or it is not authenticated, since it provides more capabilities, including deploying Neon Functions.

### Check the CLI, then credentials

```bash
neon --version
```

If that fails, install first:

```bash
npm i -g neon       # npm
bun add -g neon     # bun
pnpm add -g neon    # pnpm
```

For full CLI installation options, see https://neon.com/docs/cli/install.md

Then inspect credentials without printing secrets. `NEON_API_KEY` or a `neon profile list -o json` row whose `account` is not `-` is an account. A `DEFAULT` row with `account: "-"` and `file: "missing"` is not.

- Credentials already available: reuse them. Do not launch a browser.
- A human needs to sign in: they run `neon login` (`neon auth` is an alias). An unattended agent must not launch browser authentication.
- No account yet: follow [Starting without a Neon account](#starting-without-a-neon-account).

### Combined setup: `neon init`

When both agent tooling and project setup are needed, use authenticated `neon init`. `--agent` takes the coding-agent name. `-y` skips prompts but does not supply project selection or credentials. `--skip-template` skips scaffolding a starter app.

Link an existing project:

```bash
neon init --skip-template --agent cursor \
  --org-id <org-id> --project-id <project-id> -y
```

Create and link a project:

```bash
neon init --skip-template --agent cursor \
  --org-id <org-id> --project-name my-app \
  --region-id aws-us-east-2 -y
```

`--services` may declare `auth`, `functions`, `object-storage`, and `ai-gateway` (repeat the flag or comma-separate). Pass `none` for the bare starter policy. It writes `neon.ts`; it does not deploy or wire the app. There is no `data-api` value.

If `init` already installed the Neon plugin, do not also run `neon mcp` and `neon skills` for the same agent.

When tooling already exists, only one component is missing, or env writes need `--no-env-pull`, use the manual steps below. `init` has no `--no-env-pull`. Before a command that pulls env, inspect existing configuration. If a supplied `DATABASE_URL` or `AWS_*` value must stay, pass `--no-env-pull` on `link` / `checkout` and write env to a separate `--file`.

### 1. Install the Neon CLI

Use the install check above. Do not run `neon login` unattended. MCP remains the fallback when the CLI is unavailable, blocked, unauthenticated, or the user prefers it.

### 2. Install the Neon MCP Server

```bash
neon mcp --oauth --project --agent cursor -y
```

`--oauth` writes the server URL and leaves sign-in to the MCP client. That is not an authenticated MCP session. `--project` means project-level agent config, not a Neon project ID; the agent must support project-level installs (`cursor` does). Bare `neon mcp -y` installs globally and can reuse or mint an account-wide API key — do not treat it as the unattended default.

For all available plugins and IDE integrations, see: https://neon.com/docs/ai/ai-agents-tools.md

For full MCP server installation options, see https://neon.com/docs/ai/connect-mcp-clients-to-neon.md

### 3. Install Neon Agent Skills

```bash
neon skills -s neon --agent cursor -y
```

To install a specific skill only:

```bash
neon skills -s <skill-name> --agent cursor -y
```

Useful flags: `--global`, `-y`, `--agent <agent-name>`. Interactive `neon skills` with no flags prompts.

### 4. Link Your Project and Get Started

With setup complete, connect the workspace to a Neon org, project, and branch. Then consult the skill for each Neon feature your app requires. See [Choosing the Right Skill](#choosing-the-right-skill) above.

Non-interactive link:

```bash
neon link --project-id <project-id> -y
neon link --org-id <org-id> --project-name my-app --region-id aws-us-east-2
```

`-y` skips the already-linked confirmation and pins the default branch when the project has more than one. Pass `--branch <name>` when branch selection matters.

#### Useful CLI Commands

1. `neon link` — Writes org, project, and branch IDs to a git-ignored `.neon` file. Run once per project. Once linked, project- and branch-scoped commands no longer need `--project-id` or `--branch` (for example, `neon branch list`). Non-interactive: `--org-id` / `--project-id` / `--project-name` plus `--region-id`, and `-y` when appropriate. There is no `neon link --agent`.
2. `neon checkout <branch-name>` — Pins a branch in `.neon` and pulls that branch's env. An existing branch is enough. A missing **name** needs `--create` for unattended use (`neon checkout dev --create`). A missing branch **id** cannot be created. Interactive checkout with no name may offer to create; do not rely on that unattended. Drives the [Branch-First Dev Flow](#branch-first-dev-flow) below.
3. `neon config init` — Initializes a `neon.ts` file, which declares how you provision and manage Neon services, in the root of the project.
4. `neon env pull` — Fetches the current branch's Neon environment variables (`DATABASE_URL`, …) into your existing `.env`, or `.env.local` if you don't have one (override the target with `--file`). No branch ID needed; it reads `.neon`. **`link` and `checkout` run this for you by default**, so you rarely call it directly.

   Without `neon.ts`, a **bare** `neon env pull` includes the default Gateway credential on claimed projects. Implicit pulls bundled into `link` / `checkout` / `apply` do **not** pull an undeclared Gateway token. Declaring `aiGateway` in `neon.ts` requests those variables. With `neon.ts`, pull includes only the services declared there and errors if the branch is missing one.

### Bootstrap a New Project

If you are starting on a new project, `neon bootstrap` is a great way to quickly scaffold from one of Neon's available project templates. These templates let you explore the full range of what Neon offers — Lakebase Postgres, Object Storage, Functions, Auth, and the AI Gateway — so you can get hands-on with each capability without building from scratch:

```bash
neon bootstrap
```

## Starting without a Neon account

If the Getting Started account check found credentials, use them. If a command waits on a browser (`Awaiting authentication in web browser`) or authentication fails, stop and ask the user to sign in (`neon auth`) or mint an API key. Prefer that over Claimable Neon unless they say otherwise.

If they cannot sign in or provide a key right now, ask before using Claimable Neon. Continue only after they say yes. That is a temporary workaround.

If there is no Neon account yet, follow [references/claimable-neon.md](https://neon.com/docs/ai/skills/neon/references/claimable-neon.md). Do not run `neon init --agent` or `neon auth` on this path; those need a human Neon account. If `neon claim` is missing, the reference has the REST fallback. Unclaimed projects expire at `project_expires_at` (72 hours today). Claim codes expire in `expires_in` (15 minutes today). Add Auth or the Data API with `neon.ts` and `neon deploy` before or after claim.

Requests for neon.new, Claimable Postgres, claimable.neon.tech, instant Postgres, or a no-signup database are the same path.

## Neon Infrastructure as Code

`neon.ts` is Neon's branch config and infrastructure-as-code file: declare which Neon services your project's branches should have, get type-safe env vars, and program branch settings — all in TypeScript. It's the config layer for your Neon services, and it composes with the branch-first loop below. Add it with `@neon/config`:

```bash
npm i @neon/config
```

```typescript
// neon.ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
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
  },
});
```

### Provision services with neon config

Every project ships with Lakebase Postgres; `neon.ts` lets you also declare Neon Auth and the Data API today, with Functions, buckets, and the AI Gateway under a `preview` block — every service for the branch composes in one file:

```typescript
// neon.ts
export default defineConfig({
  auth: true,
  dataApi: true,
  preview: {
    functions: {},
    buckets: {},
    aiGateway: true, // see the neon-ai-gateway skill
  },
});
```

Reconcile the declaration from the CLI — the Neon equivalent of `terraform status` / `plan` / `apply`:

```bash
neon status          # print the branch's live config (read-only). Alias for `neon config status`.
neon config plan     # dry-run diff of what apply would change (read-only)
neon deploy --env <file>  # apply neon.ts. Pass --env when Function env reads process.env. Alias for `neon config apply`
```

`apply` / `deploy` provision the declared services **and then pull the branch's env into your local `.env.local`** (e.g. `Pulled 5 Neon variables into .env.local: DATABASE_URL, …`), so your local env always matches what's deployed.

### Function env and `neon deploy`

`neon deploy` is the preferred full deployment: it applies `neon.ts` (services and functions) to the linked branch. `neon deploy --env <file>` loads that file into `process.env` before evaluating `neon.ts`, then uploads those values as Function env. Use it every time Function env reads `process.env`.

`<file>` is the gitignored file `neon env pull` already writes (`.env` if that file exists, otherwise `.env.local`). Env pull writes Neon-managed vars only (`DATABASE_URL`, `NEON_AI_GATEWAY_*`, …). Add every key under `preview.functions.*.env` to that file yourself, then pass the same path to `--env`.

Every declared Function env key must be a defined string. `undefined` (an unset `process.env.X`) means you listed a key you want written but the value is missing: `defineConfig` throws. Omit the key from `neon.ts` if you do not want to write it. Never coerce a missing `process.env` value to an empty string: that uploads `""` and deletes the live key. An empty assignment in the file (`KEY=`) is also `""`. If TypeScript needs a type assertion, use `process.env.X!` and make sure the file actually has the value.

Use `neon functions deploy` when you are not applying `neon.ts`: a single function by slug, or a targeted `--env KEY=VALUE` update (that flag is not a file path).

### Function Triggers

A Function Trigger is a branch-scoped rule that POSTs to a Neon Function on a schedule so recurring work (a nightly report, a cleanup job, a periodic sync) does not need a separate scheduler. Beta; same regions as Functions (`us-east-2`, `eu-central-1`). The only trigger type in the current CLI, `neon.ts` schema, OpenAPI spec, and `@neon/functions` parser is `schedule` (five-field UTC cron).

**Prefer `neon.ts`.** Declare triggers on the function. `neon deploy` applies them after the function is deployed. Names must be unique among every trigger visible on the branch. Triggers that exist remotely but are omitted here are left alone; delete with `neon triggers delete`.

```typescript
preview: {
  functions: {
    cron: {
      name: "Cron Job",
      source: "src/index.ts",
      triggers: [
        {
          type: "schedule",
          name: "hourly",
          cron: "0 * * * *",
          functionPath: "/cron", // default "/"
          // enabled: true,
        },
      ],
    },
  },
}
```

Needs Neon CLI 4.17 or newer (`@neon/config` with the `triggers` field on a function).

**CLI** when you are not applying `neon.ts`, or to list, enable, disable, or delete:

```bash
neon triggers create --function-slug cron --name hourly --cron '0 * * * *' --function-path /cron
neon triggers list
neon triggers update <id> --branch <branch> --cron '*/30 * * * *'
neon triggers enable <id> --branch <branch>
neon triggers disable <id> --branch <branch>
neon triggers delete <id> --branch <branch>
```

Inspect a trigger with `neon triggers list --output json`. Pass `--branch` on get/update/enable/disable/delete: without it the CLI resolves the trigger id as a branch name. Inherited triggers (created on a parent branch) show `Inherited true` on the child and start disabled. `neon deploy` of a `neon.ts` that declares the same trigger enables that copy; omit it to leave the inherited trigger disabled.

**MCP backup** (Neon MCP server, `?category=functions`): `list_triggers`, `get_trigger`, `create_trigger`, `update_trigger`, `delete_trigger`. `create_trigger` takes `project_id`, `branch_id` (a `br-…` id, not a name), and `body` with `"type": "schedule"`, `function_slug`, `name`, and `schedule: { cron }`. REST if neither CLI nor MCP is available: `POST /projects/{project_id}/branches/{branch_id}/triggers` with the same body. CLI reference: https://neon.com/docs/cli/triggers.md.

The handler is still a normal `fetch`. Authenticate a trigger delivery with `parseTrigger` / `parseTriggerInvocation` from `@neon/functions` (≥ 0.10.0). Full type table, payload, and Hono example: the `neon-functions` skill, `references/function-triggers.md`.

### Type-safe env vars with parseEnv

`@neon/env`'s `parseEnv` takes your `neon.ts` config object and returns a parsed, typed env object, validated against the services you declared. The shape of `env` follows your config, and missing variables are flagged with clear errors.

```bash
npm i @neon/env
```

```typescript
import { parseEnv } from "@neon/env";
import config from "./neon";

const env = parseEnv(config);

console.log(env.postgres.databaseUrl);
console.log(env.auth.baseUrl);
```

By default `parseEnv` requires _every_ variable your config implies. When one of your apps only uses a subset, for example when you need to read `DATABASE_URL` but never the unpooled URL, pass an array of env-var keys to require and validate only those. The keys are typesafe: autocomplete only offers variables your config enables, and the returned shape is narrowed to exactly what you selected (so unselected variables are neither enforced nor present).

```typescript
import { parseEnv } from "@neon/env";
import config from "./neon";

// Only DATABASE_URL is required and returned; DATABASE_URL_UNPOOLED is not enforced.
const { postgres } = parseEnv(config, ["DATABASE_URL"]);
console.log(postgres.databaseUrl);

// Selecting across services — only these keys are validated.
const env = parseEnv(config, ["DATABASE_URL", "NEON_AUTH_BASE_URL"]);
console.log(env.postgres.databaseUrl, env.auth.baseUrl);
```

### Branch configuration

Beyond services, `neon.ts` can program what configuration _new_ branches receive via the `branch` property — a function of the branch being evaluated that returns its settings:

```typescript
// neon.ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  dataApi: true,
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

Because `neon.ts` is TypeScript, the compiler catches invalid infrastructure before you ever deploy — and Neon encodes the actual rules (and their fixes) into the types, so the error tells you what to do rather than failing with a useless `Type 'true' is not assignable to type 'never'`. The canonical case: the Data API verifies requests with Neon Auth by default, so enabling it on its own is a type error _on_ `dataApi`:

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

## Branch-First Dev Flow

Neon branches enable a branch-first development flow, which we recommend when using Neon services. This and `neon.ts` above are the two halves of the recommended setup — `neon.ts` declares what every branch should have, and the branch-first loop is how you move between those branches day to day. Each works on its own, and they compose.

Create a Neon branch any time you would create a git branch. Use the following commands if you have CLI access:

- `neon checkout <branch-name>` — Pins an existing branch by updating only the branch pointer in `.neon`. Pass `--create` to create a missing **name** (`neon checkout dev --create`). Run without a name for an interactive picker. It does not touch code or local Postgres.
- `neon env pull` — Fetches the current branch's Neon environment variables into your `.env`. **`link` and `checkout` run this for you by default**, so you rarely call it directly.
- `neon diff` — Shows the schema diff between the child branch and its parent. Run this to see what changes have been made to the schema since the last branch was created and before you commit your changes.

```bash
neon link                     # once; also pulls the linked branch's env
neon checkout dev-add-search --create  # per feature; also pulls the branch's env
```


Because `link` and `checkout` pull env by default, the branch's `DATABASE_URL` lands in your local `.env` automatically — build against it, then `checkout` the next branch and repeat. As the agent, drive this loop yourself: run `checkout` between tasks.

### How checkout composes with neon.ts

When a `neon.ts` is present, `neon checkout <name> --create` applies your policy as it **creates** a branch, so a fresh branch comes up with its declared settings and services already in place. Pass `--env <file>` on that create so Function env that reads `process.env` resolves (`neon checkout feat --create --env .env.local`). Existing process env wins over the file. Checking out an _existing_ branch never reconciles it — apply config changes to it explicitly with `neon deploy --env <file>` (alias for `neon config apply`). `--update-existing` auto-confirms overriding remote settings; add it only after reviewing those changes. The bundled `env pull` also checks `neon.ts` against the linked branch and fails fast if the branch is missing a declared service, pointing you at `neon deploy --env <file>` to provision it, so your local env and the remote branch never drift apart silently.

### Opting out of local env vars

If env vars are injected at runtime instead of written to disk — or you simply don't want secrets in the working tree — pass `--no-env-pull` to `link` / `checkout` and supply the env another way:

- `neon-env run -- <your dev command>` (from `@neon/env`) fetches the branch's vars from your `neon.ts` and injects them into the child process at runtime — no `.env` file needed. This is the runtime counterpart to the on-disk `env pull`.
- `neon-env export` (from `@neon/env`) prints the branch's env to stdout as dotenv lines or, with `--format json`, JSON — for piping into another env manager rather than running a command. For example, [varlock](https://varlock.dev) can bulk-load it from a `.env.schema` with `@setValuesBulk(exec("neon-env export --format json"), format=json)`.
- `fetchEnv` from `@neon/env` is the programmatic version of the same thing: resolve the branch's env in code at runtime instead of shelling out to `neon-env run`.
- `neon dev` injects the same vars into your local dev server — it's part of Neon Functions local development (a public beta feature).

When an agent should not write a local `.env`, instruct it (for example in your `AGENTS.md`) to run `neon checkout <branch> --no-env-pull` and rely on runtime injection.

For reading env you _already_ have on disk (typed and validated against your `neon.ts`), use `parseEnv` — see [Type-safe env vars with parseEnv](#type-safe-env-vars-with-parseenv) above.

## Observability

Neon exposes branch-scoped logs. **Today they cover Neon Functions and Object Storage only.** Postgres computes and the AI Gateway are coming; until then, neither emits records. Logs are region-gated like the other beta services above. `us-east-2` and `eu-central-1` are enabled today. A branch that can't serve logs at all answers `404` with `reason: telemetry_not_enabled` (the message says whether it's the wrong region or a branch not collecting telemetry yet), versus a `200` empty result when the branch is enabled but has no records in the window; an unknown branch answers `reason: branch_not_found`.

Use Neon CLI 3.1 or newer first. **Decide which branch you are querying.** Without `--branch`, the CLI uses the branch pinned in `.neon`, or the project's default branch when the workspace isn't linked. A deployed function or bucket usually lives on a different branch than the one checked out for development, so an empty result is more often the wrong branch than a missing log.

```bash
neon logs query --since 1h
neon logs query --branch production --source function --minimum-severity error --since 6h
neon logs query --source storage --since 1h --output json
neon logs fields
neon logs field-values service_name --since 1h
```

`--source` accepts `function`, `storage`, and `pg_endpoint`, but only `function` and `storage` return records today — `pg_endpoint` is accepted and comes back empty until Postgres logs ship. The window defaults to 1h on `query` and 6h on `field-values`, and cannot exceed 7d on either. If Neon reports `--minimum-severity` as unsupported on a branch, use `--severity-text` instead (an exact, case-sensitive match, e.g. `ERROR`); severities vary by source, so confirm what a branch carries with `neon logs field-values severity_text`. Run `neon logs --help` for the full filter and pagination interface.

`--logql` replaces the structured filters with a raw stream selector or line filter. Its stream label is `entity_type`, not `source`:

```bash
neon logs query --since 1h --logql '{entity_type="function"} |= "timeout"'
```

If the CLI is unavailable, fall back to the Neon MCP server's read-only `query_logs`, `list_log_fields`, and `list_log_field_values` tools.

In TypeScript applications, use `@neon/sdk`. Project and branch are positional, and `query` returns a lazy paginated iterable rather than a promise:

```typescript
for await (const record of neon.logs.query(projectId, branchId, {
  since: "1h",
  source: "function",
})) {
  console.log(record.timestamp, record.severity_text, record.message);
}

const { data: fields } = await neon.logs.fields(projectId, branchId);
const { data: serviceNames } = await neon.logs.fieldValues(
  projectId,
  branchId,
  "service_name",
);
```

`query`'s iterator always throws on error, but `fields` and `fieldValues` follow the client's `throwOnError`, which defaults to `false` and hands back `{ data, error }`. `fieldValues` resolves to the whole response, not a bare array: read `serviceNames.values`, and treat them as an arbitrary subset whenever `serviceNames.is_truncated` is true.

### Loki-compatible read API

For direct HTTP reads, authenticate with `Authorization: Bearer <NEON_API_KEY>` and use this branch-scoped base URL:

```text
https://console.neon.tech/telemetry/v1/projects/{projectId}/branches/{branchId}/loki
```

The available endpoints are:

- `GET /api/v1/query_range`
- `GET /api/v1/labels`
- `GET /api/v1/label/{name}/values`

This is a read-only Loki-compatible subset, not a push endpoint or complete Loki deployment. `query_range` supports LogQL stream selectors and line filters, plus `since` or `start`/`end`, `limit`, and `direction`; it does not support aggregations, parsers, or formatting stages.

The paths above are the ones to call directly. A Loki client that builds its own paths — a Grafana data source appends `/loki/api/v1` to whatever URL it is given — may need a different root, so confirm the data-source URL against the Neon docs rather than pasting this base.

## Manage Neon Resources

Recommended: Use `@neon/sdk` to manage Neon resources programmatically, such as creating projects, branches, and snapshots for dev scripts, CI/CD automations, and platforms building on top of Neon.

`@neon/sdk` is the official TypeScript client for the [Neon API](https://neon.com/docs/reference/api-reference.md): **Fetch-based, zero-dependency, ESM-only**, generated from Neon's [OpenAPI spec](https://neon.com/api_spec/release/v2.json) with an ergonomic layer on top. It is the successor to [`@neondatabase/api-client`](https://www.npmjs.com/package/@neondatabase/api-client) (axios-based, generated-only). The old client is **not deprecated** and is safe to keep using, but new code should prefer `@neon/sdk`.

### Neon for (Agentic) Platforms

If you're building agents that generate apps from prompts, your users want to build apps, not manage databases. Industry-leading platforms like Replit and V0 create databases on Neon because it aligns with how agents work: an instant, branchable, serverless Lakebase Postgres data layer, invisible to users.

Neon features for agents:

- Instant Provisioning: your users never wait for infrastructure.
- Snapshots: let users toggle between checkpoints of code and state together.
- Low cost-per-Database: automatic scale to zero and 350ms cold starts.
- Full-Stack, Batteries-Included: Neon Auth, Data API included at no added charge.
- Granular API Controls: Track and control usage for flexible limits and invoicing.

All details here: https://neon.com/programs/agents.md

Apply for the Neon Agent Program for special program pricing here: https://neon.com/programs/agents

## Gotchas

### Neon Auth: "invalid domain"

Neon Auth only redirects back to domains on its trusted-domains list. Anytime the domain your app runs on changes — a new production custom domain, a new deploy/preview URL, moving from `localhost` to a hosted environment, and so on — you must register the new domain with Neon Auth. Otherwise sign-in and OAuth callbacks fail with an **`invalid domain`** error because the redirect target isn't trusted.

The easiest way to fix this is the CLI. With the workspace linked to the project (see the branch-first flow above), add the new domain to the trusted list:

```bash
neon neon-auth domain add <domain>   # e.g. neon neon-auth domain add https://app.example.com
neon neon-auth domain list           # verify what's currently trusted
neon neon-auth domain delete <domain> # remove one you no longer use
```

If the workspace isn't linked, pass `--project-id <id>` (and `--branch <id|name>`) explicitly. For local development, `neon neon-auth domain allow-localhost` manages whether `localhost` is permitted. Register the domain before pointing users at the new URL, so they never hit the `invalid domain` error.
