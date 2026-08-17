# Claimable Neon

Claimable Neon provisions a temporary Neon project — Lakebase Postgres, and optionally the Data API and Managed Better Auth — before a human creates an account. The agent holds an identity assertion, not a Neon API key. A human can later claim the project into their organization.

Use this when there is no Neon account yet. Install the CLI (`npm i -g neon@latest`), then run `neon profile list -o json`. An account exists if `NEON_API_KEY` or `NEON_PROFILE` is set, or if a listed profile has `account` other than `-`. A `DEFAULT` row with `account: "-"` and `file: "missing"` is not an account. If an account exists, stop. Use those credentials. `npx neon@latest init --agent` uses DEFAULT and refuses `NEON_PROFILE`. If a listed profile has `account` other than `-`, run `neon --profile <name> link --agent` with that profile's `name`. If a command waits on a browser (`Awaiting authentication in web browser`) or authentication fails, stop and ask the user to sign in (`neon auth`) or mint an API key. Prefer that over Claimable Neon unless they say otherwise.

If they cannot sign in or provide a key right now, ask before continuing. Continue only after they say yes. That is a temporary workaround.

Do not run `npx neon@latest init --agent` or `neon auth` on this path; those need a human Neon account.

After env is pulled, use the `neon-postgres` skill for connections, schemas, and queries. Install it if it is missing:

```bash
npx skills add neondatabase/agent-skills -s neon-postgres
```

## Discover

Start at Neon docs, then use the CLI. If `neon claim` is not a command, or `neon claim --help` does not list `create`, use the REST API below. Do not guess `POST /v1/agent/identity`.

```text
https://neon.com/docs/llms.txt
```

`https://claimable.neon.tech/auth.md` is the protocol file for the REST fallback. It lives on the service origin, next to the OAuth well-known documents — not on neon.com. The Claimable Postgres docs page may appear in `llms.txt` for humans and SEO. It is not on the agent path.

## Install the Neon CLI

```bash
npm i -g neon@latest
```

https://neon.com/docs/cli/install.md
https://neon.com/docs/reference/neon-ts.md

## Create

`--api-key` and `--profile` are refused. Claimable Neon does not use a Neon account credential.

Postgres-only create works without a `neon.ts`:

```bash
neon claim create
```

For Auth or the Data API, install `@neon/config` and write ordinary `neon.ts` first, or pass `--service`. There are no claimable-specific fields. Before claim, Postgres is always granted; Auth and the Data API are granted when requested. Functions, Object Storage, and AI Gateway are recorded as `denied_capabilities` with reason `requires_claim`. Report that field. Do not retry or strip them.

If `.env` or `.env.local` already has a `DATABASE_URL` (or other Neon-managed keys), pass `--file <path>` or `--no-env-pull`. `neon claim create` otherwise replaces those keys.

```typescript
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  dataApi: true,
});
```

```bash
npm i @neon/config
neon claim create
neon branches list
```

`neon claim create` reads `neon.ts` when it is present and writes provisioned vars to an existing `.env`, otherwise `.env.local`. The CLI gitignores the file it writes. Do not run `neon auth`. The identity assertion is the pre-claim credential.

After create, report the `project_id`, `expires_at`, and `denied_capabilities` the CLI printed. Do not invent the window.

## Claim

Do not run `neon claim accept` until the human is ready. Accept mints a claim URL and puts the project in `claim_in_progress`, after which only claim-status polling remains.

When the human is ready, run `neon claim accept --no-open`. Bare `neon claim accept` opens a browser. Report the `verification_url`, `user_code`, and `expires_in_seconds` the CLI printed. If the code expires, run `neon claim accept --no-open` again. Claiming transfers the project and rotates `DATABASE_URL`. Auth and the Data API stay enabled.

```bash
neon claim accept --no-open
neon claim status
```

When `neon claim status` reports `reconciled: true`, the pre-claim `DATABASE_URL` no longer works. Auth and Data API URLs stay. The human signs in with `neon auth`. Then the agent runs `neon link --agent` and `neon env pull` to write the new `DATABASE_URL`. `neon link --agent` discovers the project after that sign-in.

Permanently delete the unclaimed project (this does not cancel a claim):

```bash
neon claim delete --yes
```

## If `neon claim` is not a command

Use the REST API when `neon claim` is missing, or when `neon claim --help` does not list `create`. Fetch `https://claimable.neon.tech/auth.md` for request and response fields. The claimable resource is `/v1/projects/{id}`, not `/v1/databases/{id}`.

```http
POST https://claimable.neon.tech/v1/agent/identity
POST https://claimable.neon.tech/v1/oauth2/token
GET  https://claimable.neon.tech/v1/projects/{id}/credentials
POST https://claimable.neon.tech/v1/projects/{id}/claim
GET  https://claimable.neon.tech/v1/projects/{id}/claim
DELETE https://claimable.neon.tech/v1/projects/{id}
```

| CLI | REST |
| --- | --- |
| `neon claim create` | `POST /v1/agent/identity`, then `POST /v1/oauth2/token`, then `GET /v1/projects/{id}/credentials` |
| `neon claim accept --no-open` | `POST /v1/projects/{id}/claim` |
| `neon claim status` | `GET /v1/projects/{id}/claim` |
| `neon claim delete --yes` | `DELETE /v1/projects/{id}` |

An agent must not complete the claim. The human opens `verification_uri_complete` and accepts the transfer. If the claim code expires, `POST /v1/projects/{id}/claim` again.

When `error.code` is `capability_requires_claim`, preserve the denied capability and give the human a claim link instead of retrying or silently omitting it.

Only `invalid_grant`, `project_expired`, and `project_claimed` mean the stored identity assertion is dead. `token_expired` means re-exchange the assertion. `claim_in_progress` means only claim-status polling remains.
