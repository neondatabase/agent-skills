# Neon Functions as an agent backend

## Functions as an Agent Backend (Next.js and Similar Frameworks)

A Neon Function is a great home for an AI agent precisely because it **doesn't time out** the way lambda-style serverless does (15-minute budget, see [Timeouts and Runtime Limits](runtime-limits.md#timeouts-and-runtime-limits)). Proxying that stream through a Next.js route handler, Remix/SvelteKit/Nuxt action, or similar hosted on Vercel, Netlify, and the like **cuts the stream when it exceeds that host's configured duration or transport limits**, even though the Function would keep going. Keep the client-direct JWT path below as the default. A streaming-compatible proxy (HTTP-triggered Cloudflare Worker, after you verify the stream) is the public-consumer exception in [Production hardening](production-hardening.md).

**Building the agent itself.** The [Vercel AI SDK](https://ai-sdk.dev) and [Mastra](https://mastra.ai) are the recommended ways to build the agent — point either at the Neon AI Gateway (see the `neon-ai-gateway` skill) for one credential across every model, with no extra provider keys. For a complete AI SDK agent running as a Function (streaming `toUIMessageStreamResponse`, multi-step tool calling next to Postgres, and persisting generated images to Object Storage), see [references/ai-sdk.md](https://neon.com/docs/ai/skills/neon-functions/references/ai-sdk.md); for the Mastra equivalent with built-in tracing, see [references/mastra-studio.md](https://neon.com/docs/ai/skills/neon-functions/references/mastra-studio.md).

**The fix: call the function directly from the client.** Don't route the long request through your app server.

```
Browser ──(Authorization: Bearer <JWT>)──▶  Neon Function (agent)   ✅ no host timeout
Browser ──▶ your app backend ──▶ Neon Function                       ❌ host cuts the stream
```

- Get a **short-lived bearer token** from the identity the app already uses. Do not switch Clerk, Better Auth, Auth.js, Supabase Auth, or Managed Auth in order to call a Function.
  - Managed Auth, default client (`createAuthClient` / Next wrapper): `authClient.token()`, then `data.token`. Verify with injected `NEON_AUTH_JWKS_URL` and issuer `new URL(process.env.NEON_AUTH_BASE_URL!).origin`.
  - Managed Auth with `SupabaseAuthAdapter()`: that client has no `.token()`. Use `getSession()`, then `data.session.access_token`. Same JWKS/issuer as above.
  - Existing Better Auth / Auth.js / other signer that already publishes JWKS: use that JWKS URL, issuer, and audience. Inspect the installed contract; cookie or database sessions are not a JWKS.
  - Cookie/database sessions only: mint a short token on the existing app backend (that call is fast and stays within host limits), then the browser calls the Function **directly** with `Authorization: Bearer`. The Function stream must not go through the app host.
- Hand the token to the client, e.g. with the Vercel AI SDK: `new DefaultChatTransport({ api: NEON_FUNCTION_URL, fetch })` where `fetch` attaches `Authorization: Bearer <token>`. Your app server is never in the path of the long stream.
- Add **CORS** so the browser can reach it (handle `OPTIONS`, set `Access-Control-Allow-Origin`/`-Headers`).

> [!WARNING]
> A Neon Function has a **public HTTPS URL — it is reachable by anyone.** A direct client→function call means there is no app backend in front of it to gate access, so **you must authenticate the function yourself.** Verify a JWT against the caller's JWKS, check a shared secret / API key, or reject the request. Never deploy an unauthenticated agent. Browser callers use short-lived user tokens. Server or proxy origin secrets (`X-Secret`) stay server-side; see [Production hardening](production-hardening.md).

```typescript
// src/index.ts — verify the caller before doing any work
import { createRemoteJWKSet, jwtVerify } from "jose";

const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL!));
const issuer = new URL(process.env.NEON_AUTH_BASE_URL!).origin;

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors(request) });

    const auth = request.headers.get("authorization");
    if (!auth?.toLowerCase().startsWith("bearer ")) {
      return new Response("Unauthorized", {
        status: 401,
        headers: cors(request),
      });
    }
    let userId: string;
    try {
      const { payload } = await jwtVerify(auth.slice(7), jwks, { issuer });
      if (!payload.sub) {
        return new Response("Unauthorized", {
          status: 401,
          headers: cors(request),
        });
      }
      userId = payload.sub;
    } catch {
      return new Response("Unauthorized", {
        status: 401,
        headers: cors(request),
      });
    }
    // Authorize resource access by userId, then run the agent scoped to that user.
    // ... return result.toUIMessageStreamResponse({ headers: cors(request) })
  },
};
```

That snippet is Managed Auth verification. Mint the bearer token with `.token()` (`data.token`) on the default client, or `getSession()` then `data.session.access_token` on `SupabaseAuthAdapter()`. For another identity, pass that app's JWKS URL and issuer through Function `env` (see [Environment Variables](environment-variables.md#environment-variables)) and include `audience` only when that token contract requires it. https://neon.com/docs/compute/functions/authentication.md

A valid token is not permission to read another user's rows. Exercise two users: each can access their own data; cross-user access is denied. Repeat after restarting the Function against stored rows. A request-supplied owner id cannot grant access.

Persist anything you need to keep (generated images, history) in Postgres — module state doesn't survive eviction.
