# Claimable Neon

Claimable Neon provisions a temporary Neon project — Lakebase Postgres, and optionally the Data API and Neon Auth — before a human creates an account. The agent holds an identity assertion, not a Neon API key. A human can later claim the project into their organization.

Use this when there is no Neon account yet, or the task is a throwaway / demo / no-signup database. Do not run `npx neon@latest init --agent` or `neon auth` on this path; those need a human Neon account.

After env is pulled, use the `neon-postgres` skill for connections, schemas, and queries. Install it if it is missing:

```bash
npx skills add neondatabase/agent-skills -s neon-postgres
```

## Discover

Start at Neon docs. Fetch `auth.md` before calling anything.

```text
https://neon.com/docs/llms.txt
https://claimable.neon.tech/auth.md
```

`https://claimable.neon.tech/auth.md` is the protocol file. It lives on the service origin, next to the OAuth well-known documents — not on neon.com. neon.com/docs/llms.txt holds that pointer. The Claimable Postgres docs page may also appear in that index for humans and SEO. It is not on the agent path.

From the service origin:

```text
https://claimable.neon.tech/llms.txt
https://claimable.neon.tech/auth.md
https://claimable.neon.tech/.well-known/oauth-protected-resource
https://claimable.neon.tech/.well-known/oauth-authorization-server
```

The authorization-server document's `agent_auth.skill` is `auth.md`. `identity_endpoint` is where you register. `claim_endpoint` starts a claim with the identity assertion.

## Install the Neon CLI

The Neon CLI is the client. Do not start from the HTTP examples unless you are implementing a client. Install it, declare services in `neon.ts`, and let the CLI register, store the identity assertion, and pull env.

```bash
npm i -g neon@latest
```

https://neon.com/docs/cli/install.md
https://neon.com/docs/reference/neon-ts.md

`neon.ts` is ordinary Neon config. There are no claimable-specific fields. Request the services the app needs; denied capabilities come back as `requires_claim` rather than being stripped client-side.

```typescript
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  dataApi: true,
});
```

```bash
neon claim create
neon branches list
neon claim accept
neon claim status
neon claim delete --yes
```

`neon claim create` reads `neon.ts` and writes `.env` by default. Use `--no-env-pull` to skip the env file.

`neon claim accept` opens the verification URL in a browser. Use `--no-open` to print the URL and give it to the human. Claiming transfers Postgres; it disables Data API and deletes Managed Better Auth and its data. Do not run `neon auth`. The identity assertion is the pre-claim credential.

`neon claim status` polls until the transfer is `reconciled`.

`neon claim delete --yes` permanently deletes the unclaimed project. It does not cancel a claim.

Unset `NEON_API_KEY` and `NEON_PROFILE` on this path. Those credentials send later commands to the regular Neon API, which has no record of the unclaimed project. `--api-key` and `--profile` are refused.

## Protocol the CLI speaks

`https://claimable.neon.tech/auth.md` is authoritative for request and response fields. Fetch it before calling anything. The claimable resource is `/v1/projects/{id}`, not `/v1/databases/{id}`.

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
