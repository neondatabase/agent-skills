# Claimable Neon

Claimable Neon provisions a temporary Neon project — Lakebase Postgres, and optionally the Data API and Neon Auth — before a human creates an account. The agent holds an identity assertion, not a Neon API key. A human can later claim the project into their organization.

Use this when there is no Neon account yet, or the task is a throwaway / demo / no-signup database. Do not run `npx neon@latest init --agent` or `neon auth` on this path; those need a human Neon account.

After env is pulled, use the `neon-postgres` skill for connections, schemas, and queries. Install it if it is missing:

```bash
npx skills add neondatabase/agent-skills -s neon -s neon-postgres
```

## Discover

Start at Neon docs. Do not guess `POST /v1/agent/identity`.

```text
https://neon.com/docs/llms.txt
https://neon.com/docs/reference/claimable-postgres.md
https://claimable.neon.tech/llms.txt
https://claimable.neon.tech/auth.md
```

`https://claimable.neon.tech/auth.md` is the protocol file. It lives on the service origin, next to the OAuth well-known documents — not on neon.com. neon.com holds the product page and a pointer.

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
npx skills add neondatabase/agent-skills -s neon -s neon-postgres
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
neon claim create --service data-api --service auth --env-pull
neon branches list
```

Do not run `neon auth`. The identity assertion is the pre-claim credential.

The HTTP below is the protocol the CLI speaks.

## Register anonymously

Request `postgres` and any optional services the app needs. `data_api` and `auth` are available before claim. `functions`, `storage`, and `ai_gateway` return a recorded `reason: "requires_claim"` decision. Calling a protected operation for one of those capabilities returns the `capability_requires_claim` error code.

```http
POST https://claimable.neon.tech/v1/agent/identity
Content-Type: application/json

{"type":"anonymous","capabilities":["postgres","data_api","auth"],"source":"your-agent"}
```

The response contains:

- `identity_assertion`: the durable secret. Store it like an API key.
- `project.id`, `project.branch_id`, and `project.expires_at`. Read `expires_at`; do not hard-code a lifetime.
- One decision for every requested capability. Check `granted` before using a service.

Registration does not create a claim. Possession of the registration response is not possession of the project.

The claimable resource is `/v1/projects/{id}`, not `/v1/databases/{id}`.

## Exchange for an access token

```http
POST https://claimable.neon.tech/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<identity_assertion>&resource=https://claimable.neon.tech/
```

The response contains a short-lived bearer `access_token` and no refresh token. Re-exchange the identity assertion when the access token expires.

## Pull credentials

```http
GET https://claimable.neon.tech/v1/projects/<project_id>/credentials
Authorization: Bearer <access_token>
```

The response contains `database_url`, the project and branch IDs, `expires_at`, and credentials for granted services:

- `services.data_api.url`
- `services.auth.base_url`
- `services.auth.jwks_url`

Write `database_url` to the project's `.env` as `DATABASE_URL`. Do not overwrite an existing key without confirmation. The project-scoped Neon API key stays inside Claimable Neon and is never returned.

## Use the project

Use `database_url` with any Postgres client. Supported Neon Management API operations are available through the scoped proxy:

```http
GET https://claimable.neon.tech/v1/projects/<project_id>/...
Authorization: Bearer <access_token>
```

Then follow `neon-postgres` for schemas, queries, and drivers.

## Claim the project

An agent must not complete the claim. Claiming requires a human proving identity to Neon. Create a short-lived human claim code when the project is ready to keep:

```http
POST https://claimable.neon.tech/v1/projects/<project_id>/claim
Authorization: Bearer <access_token>
```

Open the returned `verification_uri_complete`. The human signs in to Neon, selects a destination organization, and accepts the transfer.

Browser redemption revokes existing access tokens. Re-exchange the identity assertion; while the claim is in progress, the new token has no project scopes and authorizes only claim-status polling. Retain that access token and poll at the returned `interval`:

```http
GET https://claimable.neon.tech/v1/projects/<project_id>/claim
Authorization: Bearer <claim_status_access_token>
```

The claim moves through `pending`, `accepted`, and `reconciled`. Stop using pre-claim credentials when the browser claim starts. At `reconciled`, the identity assertion, access tokens, project key, database password, Data API, and Managed Better Auth integration no longer authorize project access. The status endpoint keeps returning the terminal `reconciled` state when retried with the retained status token.

Claim preparation deletes the pre-claim Managed Better Auth integration and its database data; the recipient can enable a new integration after transfer.

## Delete or revoke

Delete an unclaimed project:

```http
DELETE https://claimable.neon.tech/v1/projects/<project_id>
Authorization: Bearer <access_token>
```

Revoke an access token or identity assertion with `POST https://claimable.neon.tech/v1/oauth2/revoke`.

## Handle errors

Every error has an `error.code`, human-readable `error.message`, `error.origin`, `error.retryable`, and `error.request_id`. Use the code for control flow. Retry only when `error.retryable` is true.

When `error.code` is `capability_requires_claim`, preserve the denied capability and give the human a claim link instead of retrying or silently omitting it.

Only three codes mean the stored identity assertion is dead and should be discarded: `invalid_grant`, `project_expired`, and `project_claimed`. `token_expired` means re-exchange the assertion. `claim_in_progress` means only claim-status polling remains available.
