---
name: neon-ai-gateway
description: >-
  One API and one credential for frontier and open-source LLMs, built into your
  Neon branch and powered by Databricks. Use when a user wants to call an LLM,
  add AI/chat/an agent to their app, route between model providers (OpenAI,
  Anthropic, Google/Gemini, Meta, Alibaba, DeepSeek), or avoid juggling
  separate provider API keys and accounts — especially when they already use
  Neon and want AI requests to branch with their project. Works with the OpenAI
  SDK, Anthropic SDK, google-genai, the Vercel AI SDK, and Mastra by changing
  only the base URL. Triggers include "call an LLM", "add AI to my app",
  "chat completion", "model routing", "LLM proxy/gateway", "one API for all
  models", "use Claude/GPT/Gemini", "AI SDK", "Mastra agent", "Neon AI
  Gateway", and "log/rate-limit AI calls".
---

# Neon AI Gateway

This is a preview feature and only available in `us-east-2`. The Neon AI Gateway is the LLM inference layer built into your Neon branch: one API and one Neon credential give you access to frontier and open-source models from Anthropic, OpenAI, Google, Meta, Alibaba, DeepSeek, and Databricks — powered by Databricks. Your existing OpenAI/Anthropic/Gemini SDK works by changing only the base URL.

Use this skill to help the user send model calls through the gateway, wire it into the AI SDK or Mastra, and switch providers without rewiring code. Deliver a working inference request, a configured agent, or a precise answer from the official Neon docs.

## When to Use

Reach for the AI Gateway whenever an app or agent needs to call an LLM and the user would rather not manage model providers themselves:

- **One credential instead of many provider accounts.** A single Neon credential reaches the entire model catalog across seven providers. No separate OpenAI / Anthropic / Google billing, keys, or signups to provision and rotate.
- **Switch models without rewiring.** The unified endpoint is OpenAI-compatible and works with every model in the catalog — change one `model` field to move between Claude, GPT, and Gemini. Standard SDKs (OpenAI, Anthropic, google-genai) work with just a base-URL change.
- **AI follows your branches.** Each branch has its own gateway endpoint, scoped with the same lineage as your database. AI requests from a preview/feature branch are isolated to that branch — the same isolation your data already gets — which makes preview, CI, and agent environments self-contained.
- **No extra infrastructure, and it's already next to your data.** The gateway lives inside your Neon project (and is injected into Neon Functions automatically), runs on the same Databricks infrastructure that serves trillions of tokens a month, and supports streaming (SSE) out of the box.

If the user already has a deep, single-provider integration and no interest in Neon branching or multi-model routing, a direct provider SDK is fine — but the moment they want one credential, model portability, or branch-scoped AI, this is the reason to use it.

## What It Does

- **One API for all models** — Frontier and open-source models behind a single endpoint, addressed by their catalog ID (e.g. `claude-sonnet-4-6`, `gpt-5-mini`, `gemini-2-5-flash`).
- **Standard SDKs, one URL change** — OpenAI-compatible chat completions and Responses routes, Anthropic SDK (native Messages), google-genai (native Gemini).
- **Branch-scoped** — Each branch gets its own gateway host; the Neon credential authorizes requests for that branch and its descendants.
- **Streaming** — Server-sent events work on all endpoints with no extra configuration.

## Setup

The gateway is part of `neon.ts` (see the `neon` skill for the branch-first workflow and `neon.ts` basics). Enable it under `preview.aiGateway`:

```typescript
// neon.ts
import { defineConfig } from "@neondatabase/config/v1";

export default defineConfig({
  preview: {
    aiGateway: true,
  },
});
```

```bash
neonctl deploy   # provisions the gateway on the linked branch
```

## Neon Infrastructure as Code (`neon.ts`)

The `preview.aiGateway` toggle above is part of `neon.ts`, Neon's infrastructure-as-code file — one TypeScript file declares the gateway alongside every other branch service, in version control (see the `neon` skill for the full reference). Reconcile it against a branch the Terraform way:

```bash
neonctl config status   # print the branch's live config (is the gateway on?)
neonctl config plan     # dry-run diff of what apply would change
neonctl config apply    # enable the gateway on the branch  (neonctl deploy is an alias)
```

The gateway is **branch-scoped**: each branch gets its own gateway host. When a `neon.ts` is present, `neonctl checkout` applies the policy as it _creates_ a branch, so a fresh preview/CI branch comes up with the gateway already enabled. Checking out an _existing_ branch doesn't reconcile it — run `neonctl deploy` to apply changes. Provisioning (`config apply` / `deploy`), `link`, and `checkout` also pull the branch's gateway credentials into your local `.env.local`, so local runs hit the same branch gateway as the deployed function (no manual `env pull` needed).

For typed, validated access to the injected credentials, pass the same config object to `parseEnv` from `@neondatabase/env` — it returns an `env.aiGateway` namespace (`apiKey`, `baseUrl`) derived from your `neon.ts`.

## Environment variables

When `preview.aiGateway` is enabled, Neon injects the gateway credentials as **OpenAI-standard** env vars (so the OpenAI SDK and AI SDK work from the environment with no config), plus `NEON_`-branded aliases. Inside a deployed Neon Function these are injected automatically; locally, `neonctl env pull` writes them to `.env`/`.env.local` (or use `neon-env run -- <cmd>` to inject at runtime without a file):

| Variable                   | Meaning                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY`           | Gateway bearer token (a Neon credential, `nt_live_...`)                                                                                    |
| `OPENAI_BASE_URL`          | Full OpenAI-compatible chat-completions endpoint, **including** `/v1/chat/completions`: `https://<branch-id>-api.ai.<region>.aws.neon.tech/v1/chat/completions` |
| `NEON_AI_GATEWAY_TOKEN`    | Same bearer as `OPENAI_API_KEY` (survives a user overriding `OPENAI_*` with their own keys)                                                |
| `NEON_AI_GATEWAY_BASE_URL` | **Bare branch gateway host** (`scheme://host`, **no path** — no `/ai-gateway`): `https://<branch-id>-api.ai.<region>.aws.neon.tech`        |

The two base URLs are **different**: `OPENAI_BASE_URL` already includes the full `/v1/chat/completions` endpoint, while `NEON_AI_GATEWAY_BASE_URL` is just the bare host. Use the bare host when a client needs to append a provider-specific route (this is also what the `@neondatabase/ai-sdk-provider` does for you). The routes under the host are:

- `/v1/chat/completions` — unified, OpenAI **Chat Completions**-compatible; recommended default, works with every provider. This is the endpoint `OPENAI_BASE_URL` points at.
- `/ai-gateway/openai/v1` — OpenAI **Responses** API (required for `gpt-5-…-codex` variants and `gpt-5-5-pro`).
- `/ai-gateway/anthropic/v1` — native Anthropic Messages (extended thinking, prompt caching).
- `/ai-gateway/gemini/v1beta/...` — native Gemini `generateContent`.

So `${NEON_AI_GATEWAY_BASE_URL}/v1/chat/completions` equals `OPENAI_BASE_URL`; `${NEON_AI_GATEWAY_BASE_URL}/ai-gateway/openai/v1` is the Responses API route; and so on. Do **not** derive routes by replacing `/openai/v1` in `OPENAI_BASE_URL` — that path is no longer present.

For typed access, `parseEnv` (from `@neondatabase/env`) returns `env.aiGateway` (`apiKey`, `baseUrl`) derived from your `neon.ts`.

## Build agents with the Vercel AI SDK (recommended)

The [Vercel AI SDK](https://ai-sdk.dev) is the recommended way to call the gateway and build agents from TypeScript: one set of primitives (`generateText`, `streamText`, tool calling, structured output) over every catalog model, with first-class streaming for the long agent responses Neon Functions are built to host.

For multi-provider routing from a single call, use the dedicated `@neondatabase/ai-sdk-provider`. It reads `NEON_AI_GATEWAY_BASE_URL` + `NEON_AI_GATEWAY_TOKEN` and routes each model to the best endpoint (Anthropic → Messages, OpenAI/Codex → Responses, everything else → chat completions):

```typescript
import { neon } from "@neondatabase/ai-sdk-provider";
import { generateText } from "ai";

const { text } = await generateText({
  model: neon("claude-haiku-4-5"), // or gpt-5-3-codex, gemini-2-5-flash, ...
  prompt: "Summarize Postgres for me.",
});
```

On a Neon Function that streams text and generates images, the same provider exposes the gateway's built-in image generation tool while keeping route selection internal:

```typescript
import { neon } from "@neondatabase/ai-sdk-provider";
import { streamText } from "ai";

const result = streamText({
  model: neon("gpt-5-mini"),
  messages,
  tools: {
    image_generation: neon.tools.imageGeneration({
      outputFormat: "jpeg",
      size: "1024x1024",
    }),
  },
});
return result.toUIMessageStreamResponse();
```

To build an **agent** — a model that calls tools in a loop and then answers — add `tools` and a `stopWhen` budget. The loop runs in-process, so on a Neon Function it isn't cut off by lambda-style timeouts:

```typescript
import { neon } from "@neondatabase/ai-sdk-provider";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";

const { text } = await generateText({
  model: neon("claude-sonnet-4-6"),
  prompt: "How many open todos do I have, and what's the oldest one?",
  tools: {
    listTodos: tool({
      description: "List the user's open todos.",
      inputSchema: z.object({}), // AI SDK v5+: `inputSchema`, not `parameters`
      execute: async () => db.select().from(todos),
    }),
  },
  stopWhen: stepCountIs(5), // let the model call tools, then summarize
});
```

For a full AI SDK agent deployed as a Neon Function (streaming, tool calling, image generation, persistence), see the `neon-functions` skill's `references/ai-sdk.md`.

## Build agents with Mastra (recommended)

[Mastra](https://mastra.ai) is the recommended framework when you want batteries-included agents — built-in memory, tools, workflows, and tracing — with the model still pointed at the gateway. A memory-backed agent (threads/messages in Postgres via `@mastra/pg`) running as a Neon Function reads `env.aiGateway` from `parseEnv` and uses the injected **chat-completions** endpoint:

```typescript
import { Agent } from "@mastra/core/agent";
import { parseEnv } from "@neondatabase/env";
import config from "../neon";

const env = parseEnv(config);
const gatewayUrl = env.aiGateway.baseUrl;

export const personalAssistant = new Agent({
  id: "personal-assistant",
  name: "personal-assistant",
  instructions:
    "You are a warm, concise personal assistant with long-term memory.",
  model: {
    id: `neon/claude-haiku-4-5`,
    url: gatewayUrl,
    apiKey: env.aiGateway.apiKey,
  },
  memory,
});
```

## Use with plain SDKs (lower-level)

When you don't need an agent framework — a single completion, an existing provider-SDK integration, or native provider features — call the gateway with plain HTTP or SDKs. The injected `OPENAI_API_KEY` and `OPENAI_BASE_URL` point at the OpenAI-compatible **chat-completions** endpoint:

```typescript
const res = await fetch(process.env.OPENAI_BASE_URL!, {
  method: "POST",
  headers: {
    authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    messages: [{ role: "user", content: "What is Neon?" }],
  }),
});
```

For the OpenAI **Responses** API, derive the route from the bare Neon gateway host:

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.NEON_AI_GATEWAY_TOKEN,
  baseURL: `${process.env.NEON_AI_GATEWAY_BASE_URL}/ai-gateway/openai/v1`,
});

const res = await client.responses.create({
  model: "gpt-5-mini",
  input: "What is Neon?",
});
```

The Anthropic SDK and google-genai work the same way for native provider features — point them at the `/anthropic` and `/gemini` routes on the bare gateway host (`${NEON_AI_GATEWAY_BASE_URL}/ai-gateway/anthropic`, `${NEON_AI_GATEWAY_BASE_URL}/ai-gateway/gemini`).

## Model identifiers

Use a model's catalog ID directly in the `model` field — e.g. `claude-sonnet-4-6`, `gpt-5-mini`, `gemini-2-5-flash`. No provider prefix is needed. To look up the exact identifiers the gateway serves, which underlying model each maps to, and their context windows, pricing, and capabilities, use any of:

- **models.dev Neon provider page: https://models.dev/providers/neon** — the canonical, always-current list of the Neon provider's model IDs and their underlying models. The machine-readable catalog is at https://models.dev/api.json (the `neon` key).
- **Models doc:** see Further reading.

## Availability

The AI Gateway is a preview (early access) feature available only on new projects in the `us-east-2` region; it can't be enabled on existing projects. Foundation model access requires a paid Neon plan. Confirm the user's project is a new project in `us-east-2`. If the user does not yet have access, point them to the private beta sign-up: https://neon.com/blog/were-building-backends#access

## Neon Documentation

The Neon documentation is the source of truth and the AI Gateway is evolving rapidly, so always verify against the official docs. Any doc page can be fetched as markdown by appending `.md` to the URL or by requesting `Accept: text/markdown`. Find the right page from the docs index (https://neon.com/docs/llms.txt) and the changelog announcements.

## Further reading

- https://neon.com/docs/ai-gateway/overview.md
- https://neon.com/docs/ai-gateway/get-started.md
- https://neon.com/docs/ai-gateway/models.md
- https://neon.com/docs/ai-gateway/chat-completions.md
- https://neon.com/docs/ai-gateway/anthropic-messages.md
- https://neon.com/docs/ai-gateway/openai-responses.md
- https://neon.com/docs/ai-gateway/gemini.md
- https://neon.com/docs/ai-gateway/authentication.md
- https://neon.com/docs/ai-gateway/troubleshooting.md
