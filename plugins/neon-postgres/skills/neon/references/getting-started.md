# Getting started with Neon: skills, CLI, MCP, and linking

### Installing the Right Skill

First check whether the target skill is already installed and accessible (for example, it appears in the available skills list or its `SKILL.md` is present). If it is, use it directly. If it is not installed, install it with `neon skills`:

```bash
neon skills -s <skill-name>
```

Replace `<skill-name>` with the skill you need (for example, `neon-object-storage`, `neon-functions`, or `neon-ai-gateway`). Useful flags:

- `--global` — install globally instead of into the current project.
- `-y` — non-interactive mode (skip prompts).
- `--agent <agent-name>` — pick the target agent(s) for non-interactive mode.

For example, to install the object storage skill globally for a specific agent without prompts:

```bash
neon skills -s neon-object-storage --global -y --agent <agent-name>
```

`neon-auth` is not in the CLI skill catalog of current releases. Unknown names fail, so do not run `neon skills -s neon-auth`. Fetch it:

```
https://neon.com/docs/ai/skills/neon-auth/SKILL.md
```

References: https://neon.com/docs/ai/skills/neon-auth/references/managed-auth.md and https://neon.com/docs/ai/skills/neon-auth/references/self-managed.md. If those URLs are unpublished, fetch the same files from https://github.com/neondatabase/agent-skills/blob/main/skills/neon-auth/SKILL.md

If the Neon CLI is not available, you can visit https://neon.com/.well-known/agent-skills for a registry of all available Neon skills and fetch them manually.

### Updating Skills

Keep the skills up to date: for every new session, check them and update the stale ones so you are working with the latest best practices.

Run `neon skills status` (neon 8.12.0 or newer) to check the Neon skills in this directory's `skills-lock.json`, or `neon skills status --global` for user-level skills. It lists each skill as `up to date`, `outdated`, or `not found upstream`, and prints the update command when any are outdated. It exits 0 either way, so read the Status column:

```
$ neon skills status
Skills
Scope           Skill          Status
this directory  neon           outdated
this directory  neon-postgres  up to date
Update them: neon skills update -y
```

Run `neon skills update` to update all installed Neon skills, or `neon skills update -y` to skip prompts. Add `--global` for user-level skills. If the skills were installed via a plugin, they are updated automatically.

### Combined setup: `neon init`

When both agent tooling and project setup are needed, use authenticated `neon init`. It sets up the current directory in place. `--agent` takes the coding-agent name. `-y` skips prompts but does not supply project selection or credentials.

Link an existing project:

```bash
neon init --agent cursor \
  --org-id <org-id> --project-id <project-id> -y
```

Create and link a project:

```bash
neon init --agent cursor \
  --org-id <org-id> --project-name my-app \
  --region-id aws-us-east-2 -y
```

`--services` may declare `auth`, `data-api`, `functions`, `object-storage`, and `ai-gateway` (repeat the flag or comma-separate). Pass `none` for the bare starter policy. It writes `neon.ts`; it does not deploy or wire the app. Selecting `data-api` also declares Auth (the default Data API provider requires it). Use `data-api` only for PostgREST / Supabase database-client compatibility.

With `-y`, `init` installs the Neon plugin globally where the agent supports it (its MCP server signs in with OAuth). Other agents get skills and the MCP server globally, with an API key when the CLI is signed in. `--mcp-auth` and `--mcp-config-location` change the MCP setup; see `neon init --help`.

If `init` already installed the Neon plugin, do not also run `neon mcp` and `neon skills` for the same agent.

When tooling already exists, only one component is missing, or env writes need `--no-env-pull`, use the manual steps below. `init` has no `--no-env-pull`. Before a command that pulls env, inspect existing configuration. If a supplied `DATABASE_URL` or `AWS_*` value must stay, pass `--no-env-pull` on `link` / `checkout` and write env to a separate `--file`.

### 1. Install the Neon CLI

Use the install check above. Do not run `neon login` unattended. MCP remains the fallback when the CLI is unavailable, blocked, unauthenticated, or the user prefers it.

### 2. Install the Neon MCP Server

Install globally, the CLI default. One install serves every project:

```bash
neon mcp --agent <agent> -y
```

This writes an API key into the agent's user config, reusing an existing Neon MCP key or minting one (needs `neon auth` or a personal API key). Always pass `--agent`; without it, `-y` writes to every installed agent.

Add `--oauth` to store only the server URL instead; the user signs in from the agent and picks scopes on the consent page. For a project-level install, always use OAuth so no key lands in a file git can commit:

```bash
neon mcp --oauth --project --agent <agent> -y
```

`neon mcp --help` lists the other flags (`--read-only`, `--project-id`, `--category`) and supported agents.

For all available plugins and IDE integrations, see: https://neon.com/docs/ai/ai-agents-tools.md

For full MCP server installation options, see https://neon.com/docs/ai/connect-mcp-clients-to-neon.md

### 3. Install Neon Agent Skills

```bash
neon skills -s neon --agent cursor -y
```

To install a specific skill only (not `neon-auth` until the CLI catalog includes it; fetch it as in [Installing the Right Skill](#installing-the-right-skill)):

```bash
neon skills -s <skill-name> --agent cursor -y
```

Useful flags: `--global`, `-y`, `--agent <agent-name>`. Interactive `neon skills` with no flags prompts.

### 4. Link Your Project and Get Started

With setup complete, connect the workspace to a Neon org, project, and branch. Then consult the skill for each Neon feature your app requires. See [Choosing the Right Skill](../SKILL.md#choosing-the-right-skill) above.

Non-interactive link:

```bash
neon link --project-id <project-id> -y
neon link --org-id <org-id> --project-name my-app --region-id aws-us-east-2
```

`-y` skips the already-linked confirmation and pins the default branch when the project has more than one. Pass `--branch <name>` when branch selection matters.

#### Useful CLI Commands

1. `neon link` — Writes org, project, and branch IDs to a git-ignored `.neon` file. Run once per project. Once linked, project- and branch-scoped commands no longer need `--project-id` or `--branch` (for example, `neon branch list`). Non-interactive: `--org-id` / `--project-id` / `--project-name` plus `--region-id`, and `-y` when appropriate. There is no `neon link --agent`.
2. `neon checkout <branch-name>` — Pins a branch in `.neon` and pulls that branch's env. An existing branch is enough. A missing **name** needs `--create` for unattended use (`neon checkout dev --create`). A missing branch **id** cannot be created. Interactive checkout with no name may offer to create; do not rely on that unattended. Drives the [Branch-First Dev Flow](../SKILL.md#branch-first-dev-flow) below.
3. `neon config init` — Initializes a `neon.ts` file, which declares how you provision and manage Neon services, in the root of the project.
4. `neon env pull` — Fetches the current branch's Neon environment variables (`DATABASE_URL`, …) into your existing `.env`, or `.env.local` if you don't have one (override the target with `--file`). No branch ID needed; it reads `.neon`. **`link` and `checkout` run this for you by default**, so you rarely call it directly.

   Without `neon.ts`, a **bare** `neon env pull` includes the default Gateway credential on claimed projects. Implicit pulls bundled into `link` / `checkout` / `apply` do **not** pull an undeclared Gateway token. Declaring `aiGateway` in `neon.ts` requests those variables. With `neon.ts`, pull includes only the services declared there and errors if the branch is missing one.

### Bootstrap a New Project

`neon bootstrap` scaffolds from a Neon project template.

```bash
neon bootstrap
```
