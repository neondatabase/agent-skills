---
name: claimable-postgres
description: >-
  Provision an instant temporary Postgres database, Data API, and Neon Auth with
  no login, signup, or credit card, over an auth.md-compatible agent identity
  protocol at claimable.neon.tech. The agent registers itself, receives a durable
  identity assertion, exchanges it for short-lived access tokens, and hands the
  human a claim URL to keep the project. Use when a user asks for a quick
  Postgres environment, a throwaway DATABASE_URL for prototyping or tests, a
  no-signup backend for a demo, or "just give me a DB now" — and when an agent
  needs credentials of its own without a human account. Triggers include:
  "quick postgres", "temporary postgres", "no signup database", "no credit card
  database", "instant DATABASE_URL", "claimable postgres", "claimable postgres
  API", "neon.new", "agent identity", "auth.md", "register my agent".
metadata:
  parent: neon
  source: https://github.com/neondatabase/agent-skills/tree/main/skills/claimable-postgres
---

**FIRST**: Use the parent `neon` skill for a Neon overview, getting started with Neon, Neon development best practices, and more.

If the `neon` skill is not installed, fetch it from https://neon.com/docs/ai/skills/neon/SKILL.md or install it with:

```bash
npx skills add neondatabase/agent-skills --skill neon
```

# Claimable Postgres

Instant Postgres for local development, demos, prototyping, and test environments. No account required. A project expires unless a human claims it into a Neon account.

The service implements the [`auth.md`](https://claimable.neon.tech/auth.md) protocol: an agent registers itself, gets a durable identity assertion, and exchanges that assertion for short-lived, scoped, revocable access tokens. There is no human signup step anywhere in the provisioning path — the human is only involved when the project is claimed.

**Base URL:** `https://claimable.neon.tech/v1`

## What It Does

- **Provisions without an account** — one `POST` returns a live project and the agent's credential.
- **Gives the agent its own identity** — a service-signed identity assertion, not a shared secret or a human's API key.
- **Issues short-lived tokens** — access tokens expire and are revocable; the assertion is what persists.
- **Covers more than Postgres** — `postgres`, `dataapi`, and `auth` capabilities are available before the project is claimed.
- **Ends in a human claim** — the project becomes a normal Neon project when a human claims it.

## Discovery Documents

Served at the root, **not** under `/v1`:

| Document                                                                 | Purpose                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| `GET https://claimable.neon.tech/auth.md`                                | Human- and agent-readable description of the service |
| `GET https://claimable.neon.tech/.well-known/oauth-protected-resource`   | Protected resource metadata                          |
| `GET https://claimable.neon.tech/.well-known/oauth-authorization-server` | Authorization server metadata                        |
| `GET https://claimable.neon.tech/.well-known/jwks.json`                  | Public keys for verifying issued tokens              |

`auth.md` is the service's own description of the protocol. Read it when protocol details matter.

## Credential Model

Two credentials, with different lifetimes. Confusing them is the most common way to break a flow:

- **`identity_assertion`** — a service-signed JWT returned by registration. This is the durable secret. Store it; it is what every access token is minted from.
- **`access_token`** — short-lived (`expires_in` seconds, currently 3600), sent as `Authorization: Bearer`. **There are no refresh tokens.** When it expires, exchange the stored assertion again for a new one.

## Agent Workflow

1. **Register.** `POST /v1/agent/identity` with the capabilities the task actually needs.
2. **Store the assertion.** Persist `identity_assertion` and `project.id`. Treat the assertion like any other secret (see [Safety and UX Notes](#safety-and-ux-notes)).
3. **Exchange for an access token.** `POST /v1/oauth2/token`.
4. **Read capability decisions.** Check the `capabilities` array from registration — a requested capability may come back `granted: false`.
5. **Fetch credentials.** `GET /v1/databases/{id}/credentials` for connection strings and service URLs. Write the Postgres connection string to the project's `.env` as `DATABASE_URL` (do not overwrite an existing key without confirmation).
6. **Surface the claim URL.** Report `claim.url` and `claim.user_code` to the human, with the expiry.
7. **Re-exchange on expiry.** On `token_expired`, repeat step 3. Do not re-register.

### Register

```bash
curl -s -X POST "https://claimable.neon.tech/v1/agent/identity" \
  -H "Content-Type: application/json" \
  -d '{"type": "anonymous", "capabilities": ["postgres", "dataapi"]}'
```

`type` is one of `anonymous`, `service_auth`, or `identity_assertion`. Use `anonymous` when the agent has no prior credential of its own.

**Response:**

```jsonc
{
  "registration_id": "...",
  "identity_assertion": "eyJ...", // durable secret — store this
  "project": {
    "id": "...",
    "expires_at": "..." // project expiry, not token expiry
  },
  "capabilities": [
    // one decision per requested capability
    { "capability": "postgres", "granted": true },
    { "capability": "dataapi", "granted": true }
  ],
  "claim": {
    "url": "...", // give this to the human
    "user_code": "...",
    "expires_at": "..."
  }
}
```

### Exchange the assertion for an access token

Form-encoded, using the JWT bearer grant:

```bash
curl -s -X POST "https://claimable.neon.tech/v1/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
  --data-urlencode "assertion=$IDENTITY_ASSERTION" \
  --data-urlencode "resource=https://claimable.neon.tech/"
```

**Response:**

```jsonc
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "..."
}
```

### Revoke a token

```bash
curl -s -X POST "https://claimable.neon.tech/v1/oauth2/revoke" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "token=$ACCESS_TOKEN"
```

## Capabilities

Request capabilities as an array at registration. Only `postgres` is on by default; everything else must be asked for.

| Capability   | Before claiming        | Notes                                                |
| ------------ | ---------------------- | ---------------------------------------------------- |
| `postgres`   | Always granted         | The Postgres database itself                         |
| `dataapi`    | Granted when requested | Off unless listed in the request                     |
| `auth`       | Granted when requested | Neon Auth; off unless listed in the request          |
| `storage`    | Not available          | Returns `granted: false`, `reason: "requires_claim"` |
| `functions`  | Not available          | Returns `granted: false`, `reason: "requires_claim"` |
| `ai_gateway` | Not available          | Returns `granted: false`, `reason: "requires_claim"` |

Request what the task needs, including the pre-claim-unavailable ones. The service **accepts and records** a request for `storage`, `functions`, or `ai_gateway` rather than rejecting it, and answers with a decision object:

```jsonc
{
  "capability": "storage",
  "granted": false,
  "reason": "requires_claim",
  "message": "..."
}
```

That is deliberate — the request is counted so demand can be measured. Do not filter these out client-side to avoid a `granted: false`. Read the decision, tell the user the capability needs a claim first, and continue with what was granted.

Registration is not all-or-nothing: a `granted: false` entry for one capability does not fail the others.

## Resources

All resource routes require `Authorization: Bearer <access_token>`.

| Route                                | Returns                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| `GET /v1/databases/{id}`             | Status, expiry, granted capabilities, claim state       |
| `GET /v1/databases/{id}/credentials` | Connection strings and service URLs                     |
| `POST /v1/databases/{id}/claim`      | Starts a claim; returns the claim URL and a `user_code` |
| `GET /v1/databases/{id}/claim`       | Current claim state (poll while the human completes it) |
| `DELETE /v1/databases/{id}`          | Releases the project early                              |

```bash
curl -s "https://claimable.neon.tech/v1/databases/$PROJECT_ID/credentials" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Claiming

**An agent must not attempt to claim a project itself.** Claiming requires a human proving their identity to Neon. There is no agent-side path around that.

The agent's job is to surface the claim details:

1. Take `claim.url` and `claim.user_code` from the registration response, or start a claim with `POST /v1/databases/{id}/claim`.
2. Give both to the human, along with the claim expiry, and state plainly that the project goes away unless it is claimed.
3. Poll `GET /v1/databases/{id}/claim` if the flow needs to react to the claim completing.

Once claimed, the project belongs to a Neon account and is a normal Neon project, which is what the `requires_claim` capabilities are waiting on.

## Errors

Every error carries a structured envelope:

```jsonc
{
  "error": {
    "code": "...",
    "origin": "...",
    "message": "...",
    "retryable": false,
    "request_id": "..."
  }
}
```

Branch on `code`, not on the HTTP status or the message text. Include `request_id` in any bug report.

| Code                        | Stored assertion is dead | Action                                                                  |
| --------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| `capability_requires_claim` | No                       | The capability needs a claim first; tell the human                      |
| `scope_insufficient`        | No                       | The token does not cover this request                                   |
| `token_expired`             | No                       | Re-exchange the stored assertion for a new access token                 |
| `route_not_allowed`         | No                       | Read `message`                                                          |
| `unauthorized`              | No                       | Read `message`                                                          |
| `quota_exceeded`            | No                       | Read `message`; check `retryable`                                       |
| `invalid_grant`             | **Yes**                  | Discard the stored assertion                                            |
| `project_expired`           | **Yes**                  | Discard the stored assertion; the project is gone                       |
| `project_claimed`           | **Yes**                  | Discard the stored assertion; the project now belongs to a Neon account |

Only `invalid_grant`, `project_expired`, and `project_claimed` mean the stored credential is dead. Everything else is a live-credential condition — do not throw the assertion away and re-register in response to any other code.

## Auto-provisioning

If a task needs a database and the user has not provided a connection string (for example "build me a todo app with a real database"), register a project, use it, and tell the user. Always include the claim URL and `user_code` so they can keep it.

## Safety and UX Notes

- Store the `identity_assertion` as a secret. It is long-lived and is the only way to mint access tokens.
- Do not overwrite existing env vars. Check first, and skip writing or use a different key rather than clobbering.
- After writing credentials to an `.env` file, check that it is covered by `.gitignore`. If not, warn the user. Do not modify `.gitignore` without confirmation.
- Ask before running destructive seed SQL (`DROP`, `TRUNCATE`, mass `DELETE`).
- Report where the connection string was written, under which key, the claim URL and `user_code`, and that the project expires at `project.expires_at` unless claimed.
- For production workloads, recommend standard Neon provisioning instead of a claimable project.
- Release projects that are no longer needed with `DELETE /v1/databases/{id}` rather than leaving them to expire.

## Neon Infrastructure as Code (`neon.ts`)

Claimable projects are deliberately throwaway and are provisioned through the API above, so they are not managed by `neon.ts`. Once a human **claims** one into a Neon account it becomes a normal Neon project — at which point `neon.ts`, Neon's infrastructure-as-code file, is how it is managed going forward (see the `neon` skill for the full reference): declare the services its branches should have, program per-branch compute, and get type-safe env vars.

```bash
npm i @neon/config
```

```typescript
// neon.ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true, // Neon Auth
  dataApi: true, // Data API
  branch: (branch) => (branch.exists ? {} : { ttl: "7d" }), // ephemeral non-default branches
});
```

```bash
neon config apply   # provision the declared services (neon deploy is an alias)
```

If a project needs branching, multiple services, or durable infrastructure tracked in version control, recommend claiming first and then adopting `neon.ts` — rather than re-provisioning throwaway claimable projects.
