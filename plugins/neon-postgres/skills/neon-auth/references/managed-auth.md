# Managed Better Auth: implement login

Enabling `auth: true` is not implementing login. Follow the matching live quickstart, then verify sign-up, sign-in, sign-out, session, and a protected route.

- Overview: https://neon.com/docs/auth/overview.md
- Next.js (API methods): https://neon.com/docs/auth/quick-start/nextjs-api-only.md
- React (API methods, including React Router): https://neon.com/docs/auth/quick-start/react.md
- TanStack Router (UI components): https://neon.com/docs/auth/quick-start/tanstack-router.md

Keep Clerk or another working provider. Do not migrate it unless the user asks.

Framework-specific companion skills also live in [neondatabase/neon-js](https://github.com/neondatabase/neon-js) (`neon-auth-nextjs`, `neon-auth-react`, `neon-js-react`). Prefer the live Neon guides above; do not copy those SDK-local files into this repo.

## Packages

| Need | Package |
| --- | --- |
| Auth only | `@neondatabase/auth` |
| Already using the combined SDK | `@neondatabase/neon-js/auth` re-export |
| Pre-built UI | `@neondatabase/auth-ui` |

Keep an existing `SupabaseAuthAdapter()` caller on that API (`signInWithPassword`, `signInWithOAuth`). Do not mix those methods into default Better Auth examples.

The Managed client is Better Auth methods through Neon's wrapper. It is not interchangeable with bare `better-auth/client` while Auth is managed: the wrapper rejects extra plugins and implements Neon OAuth verifier / iframe popup / JWT extraction.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEON_AUTH_BASE_URL` | Branch Managed Auth URL (includes path). Next server; injected into Functions. |
| `NEON_AUTH_COOKIE_SECRET` | Next app secret for cached session cookies. Generate with `openssl rand -base64 32` (32+ characters). Not injected by Neon. |
| `VITE_NEON_AUTH_URL` | Public Auth URL for Vite / TanStack browser code. Assign the actual branch URL; env pull does not create this alias. |
| `NEON_AUTH_JWKS_URL` | Injected Functions JWKS. Verify tokens in `neon-functions`, not here. |

`neon env pull` / `neon deploy` write Managed `NEON_AUTH_BASE_URL` and `NEON_AUTH_JWKS_URL` when Auth is declared. The cookie secret and `VITE_*` name are application config.

## Next.js

`createNeonAuth` from `@neondatabase/auth/next/server`. Optional Next peer on current `@neondatabase/auth` is `>=16.0.0`; check the installed package before changing an existing app's router file.

```typescript
import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});
```

`app/api/auth/[...path]/route.ts`:

```typescript
import { auth } from "@/lib/auth/server";

export const { GET, POST } = auth.handler();
```

Browser client takes **no arguments** and talks to that same-origin proxy:

```typescript
import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();
```

Protect routes with `auth.middleware({ loginUrl: "/auth/sign-in" })` from `proxy.ts` on Next 16. Earlier Next apps may still use `middleware.ts`; match the installed SDK.

Server session:

```typescript
const { data: session, error } = await auth.getSession();
const user = session?.user;
```

Do not destructure `{ user }` from the top-level result. Do not pass options into `createAuthClient()` from `/next`. Do not put `fetchOptions` on the Managed `createAuthClient` URL-style config; adapter factories accept fetch options inside `BetterAuthReactAdapter({ fetchOptions })` / `BetterAuthVanillaAdapter(...)`.

JWT: `const { data, error } = await auth.token();` then `data.token`. Do not call `getJWTToken()` on the public client.

**Phone OTP:** the browser client exposes `phoneNumber`. Inspected `createNeonAuth` server endpoint tree has no `phoneNumber` namespace, so the Next proxy may not forward those calls. Confirm the installed SDK before wiring phone OTP through this proxy. If the namespace is missing, stop and report that; do not switch providers or bypass the existing session setup. SMS e2e needs a configured `send.otp` webhook.

## React / Vite

```typescript
import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";

export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter(),
});
```

Call adapter factories with `()`. Omit the adapter for vanilla Better Auth methods without `useSession`.

Public calls: `signUp.email({ email, password, name })`, `signIn.email({ email, password })`, `signIn.social({ provider, callbackURL })`, `getSession()`, `signOut()`. Result shape is `{ data, error }`; user is `data.user`. Handle `error` and thrown HTTP errors, pending UI, and authenticated vs unauthenticated display.

JWT: `authClient.token()` then `data.token`.

## UI

```typescript
import "@neondatabase/auth-ui/css";
import { NeonAuthUIProvider, AuthView } from "@neondatabase/auth-ui";
```

Choose one CSS import: `/css` or `/tailwind`, never both. Current `@neondatabase/auth-ui` uses `<AuthView path={path} />`. Check installed types before copying a `pathname` example from older docs.

UI flags (`emailOTP`, `magicLink`, social providers, organization) do not enable the Managed plugin. Configure the plugin on the branch, then the UI.

Preserve existing `@neondatabase/auth/react/ui` imports rather than forcing a drive-by migration. New snippets use `@neondatabase/auth-ui`.

## Cross-subdomain vs bearer JWT

`cookies.domain` shares session cookies across subdomains of one parent domain (see the neon-js `cross-domain-cookies` example). That is not cookie sharing across unrelated frontend and backend hosts. A Neon Function authenticates with `Authorization: Bearer` and the Managed JWKS; that path is supported. See https://neon.com/docs/compute/functions/authentication.md and https://neon.com/docs/auth/guides/plugins/jwt.md.

## Data API identity

Only when the app already uses PostgREST or a Supabase database client:

```typescript
import { defineConfig } from "@neon/config/v1";

export default defineConfig({ auth: true, dataApi: true });
```

Existing external IdP:

```typescript
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  dataApi: {
    authProvider: "external",
    jwksUrl: "https://your-idp/.well-known/jwks.json",
  },
});
```

Do not enable Auth merely to satisfy a `dataApi` type error in an app that never needed the Data API. External JWKS on a Claimable project is accepted only after claim. Combined SDK `createClient({ dataApi: { url, getToken } })` is a query client without `.auth`; confirm the installed `@neondatabase/neon-js` docs before introducing it.
