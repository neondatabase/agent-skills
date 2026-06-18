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
- **Standard SDKs, one URL change** — OpenAI SDK and AI SDK (OpenAI-compatible MLflow/Responses routes), Anthropic SDK (native Messages), google-genai (native Gemini).
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
| `OPENAI_BASE_URL`          | **Default chat endpoint** — full MLflow URL, **including** `/ai-gateway/mlflow/v1`: `https://<branch-id>-api.ai.<region>.aws.neon.tech/ai-gateway/mlflow/v1` |
| `NEON_AI_GATEWAY_TOKEN`    | Same bearer as `OPENAI_API_KEY` (survives a user overriding `OPENAI_*` with their own keys)                                                |
| `NEON_AI_GATEWAY_HOST` | **Bare branch gateway host** (`scheme://host`, **no path** — no `/ai-gateway`): `https://<branch-id>-api.ai.<region>.aws.neon.tech`        |

**Default = MLflow (OpenRouter-style chat completions).** `OPENAI_BASE_URL` points at the unified chat endpoint so `new OpenAI()` and Mastra work with any catalog model without dialect swaps. `NEON_AI_GATEWAY_HOST` is the bare host — append `/ai-gateway/<dialect>/v1` for native provider APIs.

Routes under the host:

- `/ai-gateway/mlflow/v1` — unified, OpenAI **Chat Completions**-compatible; **default** (`OPENAI_BASE_URL`), works with every provider.
- `/ai-gateway/openai/v1` — OpenAI **Responses** API (codex, image generation, Responses-only models). Advanced — build from bare host.
- `/ai-gateway/anthropic/v1` — native Anthropic Messages (extended thinking, prompt caching). Advanced.
- `/ai-gateway/gemini/v1beta/...` — native Gemini `generateContent`. Advanced.

Do **not** use `@ai-sdk/openai` against the gateway for multi-provider routing. Use `@neondatabase/ai-sdk-provider` — it reads `NEON_AI_GATEWAY_HOST` + `NEON_AI_GATEWAY_TOKEN` and routes each model to the best dialect internally.

For typed access, `parseEnv` (from `@neondatabase/env`) returns `env.aiGateway` (`apiKey`, `baseUrl`) derived from your `neon.ts`.

## Use with the Vercel AI SDK

Use `@neondatabase/ai-sdk-provider` (not `@ai-sdk/openai`). It reads `NEON_AI_GATEWAY_HOST` + `NEON_AI_GATEWAY_TOKEN` and routes each model to the best endpoint (Anthropic → Messages, OpenAI/Codex → Responses, everything else → MLflow):

```typescript
import { neon } from "@neondatabase/ai-sdk-provider/v1";
import { generateText } from "ai";

const { text } = await generateText({
  model: neon("claude-haiku-4-5"), // or gpt-5-3-codex, gemini-2-5-flash, ...
  prompt: "Summarize Postgres for me.",
});
```

For OpenAI Responses-only features (image generation, codex), the provider routes to `/ai-gateway/openai/v1` automatically — e.g. `neon.tools.imageGeneration` with `neon("gpt-5-mini")`.

## Use with Mastra

Point Mastra at `OPENAI_BASE_URL` (MLflow) and `OPENAI_API_KEY`:

```typescript
import { Agent } from "@mastra/core/agent";

export const personalAssistant = new Agent({
  id: "personal-assistant",
  name: "personal-assistant",
  instructions: "You are a warm, concise personal assistant.",
  model: {
    id: "neon/claude-haiku-4-5",
    url: process.env.OPENAI_BASE_URL!,
    apiKey: process.env.OPENAI_API_KEY!,
  },
});
```

With `parseEnv`, `env.aiGateway.baseUrl` is the MLflow URL when env injection is up to date.

## Use with plain SDKs

`OPENAI_BASE_URL` points at MLflow, so `new OpenAI()` picks up the default chat endpoint with **zero config**:

```typescript
import OpenAI from "openai";

const client = new OpenAI();

const res = await client.chat.completions.create({
  model: "claude-haiku-4-5", // any catalog model
  messages: [{ role: "user", content: "What is Neon?" }],
});
```

For native OpenAI **Responses** (advanced), point at `${NEON_AI_GATEWAY_HOST}/ai-gateway/openai/v1` and call `client.responses.create()`.

The Anthropic SDK and google-genai work the same way for native provider features — point them at the `/anthropic` and `/gemini` routes on the bare gateway host (`${NEON_AI_GATEWAY_HOST}/ai-gateway/anthropic`, `${NEON_AI_GATEWAY_HOST}/ai-gateway/gemini`).

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
