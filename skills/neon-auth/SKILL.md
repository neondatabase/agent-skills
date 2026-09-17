---
name: neon-auth
description: >-
  Add authentication to a new app. Use for "add auth", "add login", Neon Auth
  (Managed Better Auth), sign-up, sign-in, password reset, email OTP, magic
  links, organizations, phone OTP, OAuth, passkeys, MFA, trusted domains,
  invalid domain, and @neondatabase/auth. Default undecided login to Neon Auth;
  keep working identity providers. Use self-managed Better Auth on Neon when a
  required plugin exceeds Managed support. Also use for the auth APIs in
  @neondatabase/neon-js, Better Auth plugin support, SSO, API keys, and MCP
  OAuth when choosing identity for a Neon app or Function.
metadata:
  parent: neon
  source: https://github.com/neondatabase/agent-skills/tree/main/skills/neon-auth
---

**FIRST**: Use the parent `neon` skill for a Neon overview, getting started with Neon, Neon development best practices, and more.

If the `neon` skill is not installed, fetch it from https://neon.com/docs/ai/skills/neon/SKILL.md or install it with:

```bash
neon skills -s neon -y
```

# Neon Auth

Neon Auth is Managed Better Auth: users, sessions, and auth config live in the `neon_auth` schema on the branch's Lakebase Postgres, and auth state branches with the database. The client API is the Better Auth method set (`signIn.email`, `signIn.social`, `getSession`) through `@neondatabase/auth`. That wrapper is not a drop-in for bare `better-auth/client`: it pins the plugin list and adds Neon-specific OAuth verifier, iframe popup, and JWT handling. Stay on the wrapper while Auth is managed.

Start here for undecided login. Keep Clerk or another working provider unless the user asks to migrate. A needed Better Auth plugin that Managed Auth does not support is the signal to run self-managed Better Auth on Neon instead.

## When to Use

1. Inspect existing identity. Keep Clerk, another IdP, or a working Better Auth server unless the user requests migration. A supplied `DATABASE_URL` is not a reason to change identity.
2. Before enabling Managed Auth, confirm the project is on AWS and does not use IP Allow or Private Networking. Leave those protections in place.
3. Check the required feature against the [plugin matrix](#plugin-support). Configure supported plugins through Neon (Console, API, or `neon neon-auth`), not by passing `plugins` into `@neondatabase/auth`.
4. If a required plugin, hook, custom JWT claim, or server option is outside Managed support, run self-managed Better Auth on Neon (existing app host, or a Neon Function). Keep Lakebase Postgres. Use `better-auth` / `better-auth/client`. Do not inject plugins into the Neon wrapper.
5. If support is unknown, fetch the live guide. Continue with Managed Auth when supported, or self-managed Better Auth on Neon when unsupported. Stop only if support remains unresolved.
6. For undecided login that fits Managed support, follow [Managed setup](#managed-setup) and [references/managed-auth.md](references/managed-auth.md). For self-managed Better Auth on Neon, skip Managed setup and load [references/self-managed.md](references/self-managed.md). Enabling the service is not implementing login.

## What It Does

- **Managed identity in Postgres** — users and sessions in `neon_auth`, queryable with SQL, compatible with RLS.
- **Branches with the database** — each branch has its own Auth URL and isolated auth state.
- **Better Auth client methods via the Neon SDK** — `@neondatabase/auth` (auth only) or `@neondatabase/neon-js/auth` (combined SDK). Optional UI: `@neondatabase/auth-ui`.
- **Fixed plugin set** — the Managed client does not accept a `plugins` option. See [plugin support](#plugin-support).

## Availability

Managed Better Auth is generally available. AWS regions only. It cannot be enabled on a project with IP Allow or Private Networking.

Organization is separately Partial / Beta. Hosting self-managed Better Auth in a Neon Function follows Functions availability and claim rules; use the `neon-functions` skill for that host. An unclaimed project that can enable Auth still cannot use Functions until claim.

## Managed setup

Merge Auth into the existing `neon.ts`. Do not replace other fields:

```typescript
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
});
```

```bash
neon deploy
neon neon-auth status
```

If Function env in that config reads `process.env`, use `neon deploy --env <file>` as the parent skill describes. The manual service command is `neon neon-auth enable`; do not run both enable and deploy as redundant required steps when `neon.ts` already declares `auth: true`.

Then implement login: [references/managed-auth.md](references/managed-auth.md).

Claimable projects: follow the parent Claimable path, then `auth: true` and `neon deploy` when login is requested and no existing provider should be preserved.

## Verification

On either path, done means sign-up, sign-in, sign-out, session restoration after reload, and protected access work, including error and loading states. Also exercise the required plugin's actual flow (passkey register then sign-in, MFA enroll then challenged sign-in, emailed invitation accepted). Report any flow that remains unverified.

## Plugin support

Checked 2026-09-17 against https://neon.com/docs/auth/guides/plugins.md, https://neon.com/docs/auth/roadmap.md, and the `@neondatabase/auth` client plugin list. Re-fetch those pages if this skill may be stale. An unlisted upstream plugin needs a live check; do not treat absence from this table as a dated roadmap item.

"Not exposed" means the Managed SDK/UI contract. It is not a claim that every raw server request was tested.

| Feature | Managed Auth | Boundary |
| --- | --- | --- |
| Email/password | Supported | `signUp.email`, `signIn.email` |
| Social OAuth (Google, GitHub, Vercel) | Supported | `signIn.social`. Shared Google credentials are for development; production and GitHub/Vercel need your own OAuth apps. https://neon.com/docs/auth/guides/setup-oauth.md |
| Admin | Supported | Admin session required. Plugin customization is on the roadmap. |
| Email OTP | Supported | Managed delivery. `emailOtp.sendVerificationOtp`, `signIn.emailOtp`. |
| Magic Link | Supported | Enable on the branch (off by default). `signIn.magicLink`. |
| Organization | Partial, Beta | Members, invitations, owner/admin/member. No Teams, server hooks, custom roles/permissions, or dynamic access control. Emailed invitations: [managed-auth.md](references/managed-auth.md#organization-invitations). |
| JWT | Supported | EdDSA (Ed25519), 15-minute expiry, no custom claims. Retrieve with `.token()` (`data.token`). |
| Open API | Supported | Server routes `/reference` and `/open-api/generate-schema`. |
| Phone Number | Supported with constraints | Browser client: existing users link a number, then sign in; no phone-first signup; own SMS webhook; custom UI. Next.js `auth.handler()` forwards the catch-all path, including phone OTP. A missing `auth.phoneNumber` server method is a missing typed helper, not a proxy rejection. https://neon.com/docs/auth/guides/plugins/phone-number.md |
| MFA / Two-Factor | Roadmap | Unavailable on Managed Auth. Required for this app: self-managed Better Auth on Neon. [references/self-managed.md](references/self-managed.md) |
| Passkey, API Key, Generic OAuth, One Tap, Multi Session | Not exposed by Managed SDK/UI | Required for this app: self-managed Better Auth on Neon. Generic OAuth is not the same as Google/GitHub/Vercel social sign-in. |
| MCP / OAuth Provider | Use self-managed Better Auth on Neon | Third-party MCP clients self-authorizing against your server. See `neon-functions` and [references/self-managed.md](references/self-managed.md). |
| SSO / SAML | Not listed or exposed | Required for this app: self-managed Better Auth on Neon. Upstream Better Auth documents it. |

`anonymousTokenClient()` on the Managed client is a Neon-specific anonymous Data API JWT. It is not Better Auth's Anonymous-account plugin (`signIn.anonymous`).

Trusted domains and webhooks are Neon settings, not installable Better Auth plugins.

## Trusted domains

Auth redirects only to origins on its allowlist. `invalid domain` means the app origin is missing. Include the scheme, omit a trailing slash, register production and preview origins before pointing users at them, and target the correct branch:

```bash
neon neon-auth domain add https://app.example.com
neon neon-auth domain list
neon neon-auth domain delete https://old.example.com
```

Localhost ports are pre-approved by default. An existing project can have that off: `neon neon-auth domain allow-localhost get|enable|disable`. Docs: https://neon.com/docs/auth/guides/configure-domains.md

OAuth provider redirect is `{NEON_AUTH_BASE_URL}/callback/{provider}` (the Auth URL includes its path). `callbackURL` on `signIn.social` is the later app landing origin and must be trusted.

The Managed SDK handles iframe OAuth popup and `neon_auth_session_verifier`. Keep the wrapper, callback route, and middleware. Do not reimplement that flow, and do not promise third-party cookies in every browser.

## Functions and Data API

A Function that authenticates a Managed user stays on Managed Auth. Verify the JWT in the `neon-functions` skill and https://neon.com/docs/compute/functions/authentication.md (`NEON_AUTH_JWKS_URL`, issuer from `NEON_AUTH_BASE_URL`). Retrieve the token with `.token()` (`data.token`). A valid token is not permission to read another user's rows. Sign-out ends the browser session; do not claim it immediately revokes an already-issued JWT.

Third-party MCP OAuth is a separate provider: [references/self-managed.md](references/self-managed.md) and `neon-functions` `references/mcp.md`. Fetch current Better Auth MCP docs for the installed version before using that sketch.

Data API identity: [references/managed-auth.md](references/managed-auth.md). New apps query Postgres from Functions or existing handlers, not the Data API.
