# Agent Skills

A collection of [Agent Skills](https://agentskills.io/). As per the Agent Skills spec, skills are folders of instructions, scripts, and resources that agents can discover and use to do things more accurately and efficiently.

## Available Skills

### Choose Your Neon Connection Method

[skills/choose-connection-method](skills/choose-connection-method/SKILL.md)

Helps choose the right Neon Postgres connection method based on deployment platform (Vercel, Cloudflare, Netlify, Railway, etc.) and runtime environment (serverless, edge, long-running).

### Neon API

[skills/neon-api](skills/neon-api/SKILL.md)

Use this skill when managing Neon projects, branches, compute endpoints, databases, roles, API keys, organizations, or operations programmatically via the Neon REST API.

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
