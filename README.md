<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://neon.com/brand/neon-logo-dark-color.svg?new">
  <source media="(prefers-color-scheme: light)" srcset="https://neon.com/brand/neon-logo-light-color.svg?new">
  <img width="250px" alt="Neon Logo fallback" src="https://neon.com/brand/neon-logo-dark-color.svg?new">
</picture>

# Agent Skills

A collection of [Agent Skills](https://agentskills.io/) and agent integrations for Neon Serverless Postgres.

## What are Agent Skills?

Skills are folders of instructions, scripts, and resources that agents can discover and use to do things more accurately and efficiently. Once installed, skills are automatically invoked by the agent upon detection of relevant tasks.

It all starts with the `SKILL.md` file in the skill's directory. It's the entry point and allows agents to progressively discover information as needed.

## Available Skills

### Neon

[![neon](https://shieldcn.dev/skills/installs/neondatabase/agent-skills/neon.svg?variant=branded&size=xs&label=neon)](https://skills.sh/neondatabase/agent-skills/neon)

An overview of the Neon platform for apps and agents — Postgres, Auth, Data API, Object Storage, Compute Functions, and the AI Gateway — and how to get started.

### Neon Postgres

[![neon-postgres](https://shieldcn.dev/skills/installs/neondatabase/agent-skills/neon-postgres.svg?variant=branded&size=xs&label=neon-postgres)](https://skills.sh/neondatabase/agent-skills/neon-postgres)

A comprehensive index of Neon Serverless Postgres documentation and best practices to set your agents up for success.

### Neon Postgres Agent Platforms

[![neon-postgres-agent-platforms](https://shieldcn.dev/skills/installs/neondatabase/neon-for-agent-platforms/neon-postgres-agent-platforms.svg?variant=branded&size=xs&label=neon-postgres-agent-platforms)](https://skills.sh/neondatabase/neon-for-agent-platforms/neon-postgres-agent-platforms)

For agent platforms, codegen tools, and multi-tenant SaaS products that provision and run Neon Postgres for their users. Includes a companion skill and samples in [neondatabase/neon-for-agent-platforms](https://github.com/neondatabase/neon-for-agent-platforms).

### Neon Postgres Branches

[![neon-postgres-branches](https://shieldcn.dev/skills/installs/neondatabase/agent-skills/neon-postgres-branches.svg?variant=branded&size=xs&label=neon-postgres-branches)](https://skills.sh/neondatabase/agent-skills/neon-postgres-branches)

Choose and create the right Neon branch type for migration testing and isolated development workflows, including schema-only branches for sensitive data and reset-from-parent workflows to quickly realign child branches.

### Claimable Postgres

[![claimable-postgres](https://shieldcn.dev/skills/installs/neondatabase/agent-skills/claimable-postgres.svg?variant=branded&size=xs&label=claimable-postgres)](https://skills.sh/neondatabase/agent-skills/claimable-postgres)

Provision instant temporary Postgres databases via Claimable Postgres by Neon ([neon.new](https://neon.new)) with no login, signup, or credit card. Supports REST API, CLI, and SDK.

### Neon Postgres Egress Optimizer

[![neon-postgres-egress-optimizer](https://shieldcn.dev/skills/installs/neondatabase/agent-skills/neon-postgres-egress-optimizer.svg?variant=branded&size=xs&label=neon-postgres-egress-optimizer)](https://skills.sh/neondatabase/agent-skills/neon-postgres-egress-optimizer)

Diagnose and fix excessive Postgres egress (network data transfer) in a codebase. Use when investigating high database bills, unexpected data transfer costs, or query overfetching.

### Neon Object Storage

[![neon-object-storage](https://shieldcn.dev/skills/installs/neondatabase/agent-skills/neon-object-storage.svg?variant=branded&size=xs&label=neon-object-storage)](https://skills.sh/neondatabase/agent-skills/neon-object-storage)

S3-compatible object storage that branches with your Neon project, so files and database rows stay in sync across dev, preview, and production environments.

### Neon AI Gateway

[![neon-ai-gateway](https://shieldcn.dev/skills/installs/neondatabase/agent-skills/neon-ai-gateway.svg?variant=branded&size=xs&label=neon-ai-gateway)](https://skills.sh/neondatabase/agent-skills/neon-ai-gateway)

One API and one Neon credential for frontier and open-source LLMs from multiple providers, built into your branch and compatible with the OpenAI, Anthropic, and Vercel AI SDKs.

### Neon Functions

[![neon-functions](https://shieldcn.dev/skills/installs/neondatabase/agent-skills/neon-functions.svg?variant=branded&size=xs&label=neon-functions)](https://skills.sh/neondatabase/agent-skills/neon-functions)

Long-running, serverless Node.js HTTP functions deployed onto your Neon branch, with `DATABASE_URL` injected automatically and compute that runs next to your data.

## Installation

```bash
npx skills add neondatabase/agent-skills
```

### Claude Code Plugin

You can also install the skills as a Claude Code plugin, which bundles the Neon agent skills (`neon`, `neon-postgres`, `neon-postgres-branches`) and the [Neon MCP Server](https://mcp.neon.tech) for natural language database management:

```
/plugin marketplace add neondatabase/agent-skills
/plugin install neon-postgres@neon
```

After installation, you'll be prompted to authenticate with Neon via OAuth when you first use MCP tools.

The top-level `skills/` directory remains the source of truth. Plugin folders symlink only the skill directories they expose.

### Cursor Plugin

This repository also includes Cursor plugin packaging with the same scope as the Claude plugin (the Neon agent skills and the Neon MCP Server).

Run this command in chat:

```text
/add-plugin neon-postgres
```

## Usage

Example prompts:

```
Get started with Neon
```

```
Recommend a connection method for this project
```

```
Set up Drizzle ORM with Neon
```

```
Set up Neon Auth for my Next.js app
```

```
Query the database using neon-js
```

```
Create a new Neon branch using the API
```

```
Use the serverless driver for edge functions
```

```
Give me a quick temporary Postgres database
```

```
Why is my Neon bill so high?
```
