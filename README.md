# Agent Skills

A collection of [Agent Skills](https://agentskills.io/). As per the Agent Skills spec, skills are folders of instructions, scripts, and resources that agents can discover and use to do things more accurately and efficiently.

## Available Skills

### Get Started with Neon

[skills/neon-get-started](skills/neon-get-started/SKILL.md)

Interactive guide to help users get started with Neon. Sets up Neon project, connection strings, dependencies, schema, and authentication.

### Choose Your Neon Connection Method

[skills/choose-connection-method](skills/choose-connection-method/SKILL.md)

Helps choose the right Neon Postgres connection method based on deployment platform (Vercel, Cloudflare, Netlify, Railway, etc.) and runtime environment (serverless, edge, long-running).

### Neon Serverless Driver

[skills/neon-serverless](skills/neon-serverless/SKILL.md)

Use this skill when querying Neon databases using the `@neondatabase/serverless` driver. Covers HTTP queries (neon function), WebSocket connections (Pool/Client), transactions, and ORM integration.

### Neon + Drizzle ORM

[skills/neon-drizzle](skills/neon-drizzle/SKILL.md)

Use this skill when integrating Neon (serverless Postgres) with Drizzle ORM. Covers connection setup (HTTP vs WebSocket), schema definition, migrations, transactions, and query patterns.

### Neon Auth

[skills/neon-auth](skills/neon-auth/SKILL.md)

Use this skill when implementing authentication with `@neondatabase/auth`. Sets up sign-in, sign-up, social login (Google, GitHub), session management, and auth UI components for Next.js, React SPA, or Node.js projects.

### Neon JS SDK

[skills/neon-js](skills/neon-js/SKILL.md)

Use this skill when building apps with `@neondatabase/neon-js` SDK for combined Auth and Data API (PostgREST-style database queries). Full SDK for Next.js, React SPA, or Node.js projects.

### Neon API

[skills/neon-api](skills/neon-api/SKILL.md)

Use this skill when managing Neon projects, branches, compute endpoints, databases, roles, API keys, organizations, or operations programmatically via the Neon REST API.

### Neon TypeScript SDK

[skills/neon-typescript-sdk](skills/neon-typescript-sdk/SKILL.md)

Use this skill when managing Neon projects, branches, databases, and other resources programmatically using the `@neondatabase/api-client` TypeScript SDK.

### Neon Python SDK

[skills/neon-python-sdk](skills/neon-python-sdk/SKILL.md)

Use this skill when managing Neon projects, branches, databases, and other resources programmatically using the `neon-api` Python SDK.

### Referencing Neon Docs

[skills/referencing-neon-docs](skills/referencing-neon-docs/SKILL.md)

Use this skill when you need to look up Neon documentation, verify Neon-related information, or find accurate details about Neon features, APIs, or configurations.

## Installation

```bash
npx add-skill neondatabase/agent-skills
```

## Usage

Installed skills are automatically invoked by the agent upon detection of relevant tasks.

**Examples:**

```
Recommend a connection method for this project and my Neon database
```

```
Set up Drizzle ORM for Neon
```

```
Set up Neon Auth
```

```
Create a projects list route and query all projects from the database using neon-js
```
