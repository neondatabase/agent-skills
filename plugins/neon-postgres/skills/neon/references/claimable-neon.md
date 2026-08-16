# Claimable Neon

Claimable Neon provisions a temporary Neon project — Lakebase Postgres, and optionally the Data API and Neon Auth — before a human creates an account. The agent holds an identity assertion, not a Neon API key. A human can later claim the project into their organization.

Use this when you need a Neon account and the user is not around. Provision a project now; they claim it later. Do not run `npx neon@latest init --agent` or `neon auth` on this path; those need a human Neon account.

After env is pulled, use the `neon-postgres` skill for connections, schemas, and queries. Install it if it is missing:

```bash
npx skills add neondatabase/agent-skills -s neon-postgres
```

## Discover

Start at Neon docs. `llms.txt` lists this job and points at `auth.md`. Fetch that file, then install the CLI. Do not POST the HTTP endpoints unless you are implementing a client.

```text
https://neon.com/docs/llms.txt
https://claimable.neon.tech/auth.md
```

`https://claimable.neon.tech/auth.md` is the protocol file. It lives on the service origin, next to the OAuth well-known documents — not on neon.com. neon.com/docs/llms.txt holds that pointer. The Claimable Postgres docs page may also appear in that index for humans and SEO. It is not on the agent path.

## Install the Neon CLI

The Neon CLI is the client. Install it, declare services in `neon.ts`, and let the CLI register, store the identity assertion, and pull env.

```bash
npm i -g neon@latest
```

https://neon.com/docs/cli/install.md
https://neon.com/docs/reference/neon-ts.md

`neon.ts` is ordinary Neon config. There are no claimable-specific fields. Request the services the app needs; denied capabilities come back on the registration as `capabilities[].reason: "requires_claim"` rather than being stripped client-side.

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

`neon claim create` reads `neon.ts` and writes `.env` by default. The CLI gitignores `.env` when it writes it. Do not overwrite existing env vars. Use `--no-env-pull` to skip the env file. Do not run `neon auth`. The identity assertion is the pre-claim credential.

When a human is ready to claim, print the claim URL. Bare `neon claim accept` opens a browser. Claiming transfers Postgres; it disables Data API and deletes Managed Better Auth and its data.

```bash
neon claim accept --no-open
neon claim status
```

Permanently delete the unclaimed project (this does not cancel a claim):

```bash
neon claim delete --yes
```

## Protocol the CLI speaks

`https://claimable.neon.tech/auth.md` is authoritative for request and response fields. Client implementers also read the origin's `.well-known` documents. The claimable resource is `/v1/projects/{id}`, not `/v1/databases/{id}`.

```text
POST /v1/agent/identity
POST /v1/oauth2/token
GET  /v1/projects/{id}/credentials
GET|PATCH|POST /v1/projects/{id}/…
POST /v1/projects/{id}/claim
GET  /v1/projects/{id}/claim
DELETE /v1/projects/{id}
```

An agent must not complete the claim. `neon claim accept` creates the code; a human opens the URL and accepts the transfer.

When `error.code` is `capability_requires_claim`, preserve the denied capability and give the human a claim link instead of retrying or silently omitting it.

Only `invalid_grant`, `project_expired`, and `project_claimed` mean the stored identity assertion is dead. `token_expired` means re-exchange the assertion. `claim_in_progress` means only claim-status polling remains.
