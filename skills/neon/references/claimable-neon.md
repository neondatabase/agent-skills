# Claimable Neon

Claimable Neon provisions a temporary Neon project — Lakebase Postgres, and optionally the Data API and Managed Better Auth — before a human creates an account. The agent holds an identity assertion, not a Neon API key. A human can later claim the project into their organization.

Use this when you need a Neon account and the user is not around. Provision a project now; they claim it later. Do not run `npx neon@latest init --agent` or `neon auth` on this path; those need a human Neon account.

After env is pulled, use the `neon-postgres` skill for connections, schemas, and queries. Install it if it is missing:

```bash
npx skills add neondatabase/agent-skills -s neon-postgres
```

## Discover

Start at Neon docs. `llms.txt` lists this job and points at `auth.md`. Fetch that file, then use the CLI. If the CLI is not available, use the REST API below. Do not guess `POST /v1/agent/identity`.

```text
https://neon.com/docs/llms.txt
https://claimable.neon.tech/auth.md
```

`https://claimable.neon.tech/auth.md` is the protocol file. It lives on the service origin, next to the OAuth well-known documents — not on neon.com. neon.com/docs/llms.txt holds that pointer. The Claimable Postgres docs page may also appear in that index for humans and SEO. It is not on the agent path.

## Install the Neon CLI

The Neon CLI is the client. Install it, declare services in `neon.ts`, and let the CLI register, store the identity assertion, and pull env.

```bash
npm i -g neon@latest
npm i @neon/config
```

https://neon.com/docs/cli/install.md
https://neon.com/docs/reference/neon-ts.md

`neon.ts` is ordinary Neon config. There are no claimable-specific fields. Before claim, Postgres is always granted; Auth and the Data API are granted when requested. Functions, Object Storage, and AI Gateway are recorded as `denied_capabilities` with reason `requires_claim`. Report that field. Do not retry or strip them.

If `.env` or `.env.local` already has a `DATABASE_URL` (or other Neon-managed keys), pass `--file` or `--no-env-pull`. `neon claim create` otherwise replaces those keys.

```typescript
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  dataApi: true,
});
```

```bash
unset NEON_API_KEY NEON_PROFILE
neon claim create
neon branches list
```

`NEON_API_KEY` and `NEON_PROFILE` send later commands to the regular Neon API, which has no record of the unclaimed project. `--api-key` and `--profile` are refused.

`neon claim create` reads `neon.ts` and writes provisioned vars to an existing `.env`, otherwise `.env.local`. The CLI gitignores the file it writes. Do not run `neon auth`. The identity assertion is the pre-claim credential.

After create, report the `project_id`, `expires_at`, and `denied_capabilities` the CLI printed. Do not invent the window. Do not run `neon claim accept` until the human is ready to claim. Accept mints a claim URL and puts the project in `claim_in_progress`, after which only claim-status polling remains.

When the human is ready, run `neon claim accept --no-open`. Bare `neon claim accept` opens a browser. Report the `verification_url`, `user_code`, and `expires_in_seconds` the CLI printed. If the code expires, run `neon claim accept --no-open` again. Claiming transfers the project and rotates `DATABASE_URL`. Auth and the Data API stay enabled.

```bash
neon claim accept --no-open
neon claim status
```

When `neon claim status` reports `reconciled: true`, the pre-claim `DATABASE_URL` no longer works. Auth and Data API URLs stay. The human signs in with `neon auth`. Then the agent runs `neon link --agent` against the destination organization and `neon env pull` to write the new `DATABASE_URL`.

Permanently delete the unclaimed project (this does not cancel a claim):

```bash
neon claim delete --yes
```

## If the CLI is not available

Use the REST API. `https://claimable.neon.tech/auth.md` is authoritative for request and response fields. The claimable resource is `/v1/projects/{id}`, not `/v1/databases/{id}`.

```http
POST https://claimable.neon.tech/v1/agent/identity
POST https://claimable.neon.tech/v1/oauth2/token
GET  https://claimable.neon.tech/v1/projects/{id}/credentials
GET|PATCH|POST https://claimable.neon.tech/v1/projects/{id}/…
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
