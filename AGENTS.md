# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, etc.) when working with code in this repository.

For the complete Agent Skills specification, see: https://agentskills.io/specification

## Repository Overview

A collection of skills for coding agents for working with Neon Serverless Postgres. Skills are packaged instructions and documentation that extend the agent's capabilities.

## Downstream Marketplaces — Keep in Sync

This repo (`skills/`) is the source of truth. The Neon skills are also published as plugins in external marketplaces that **vendor their own copies** of the skill files, so changes here do **not** propagate automatically. Whenever you add or change a skill, open a PR in each downstream marketplace to mirror it:

- **OpenAI** — [`openai/plugins`](https://github.com/openai/plugins), Neon plugin at `plugins/neon-postgres/` (fork: `andrelandgraf/plugins`)
- **Grok (xAI)** — [`xai-org/plugin-marketplace`](https://github.com/xai-org/plugin-marketplace), Neon plugin at `external_plugins/neon/` (fork: `andrelandgraf/plugin-marketplace`)

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full sync checklist.

## Creating a New Skill

### Directory Structure

```
skills/
  {skill-name}/           # kebab-case directory name
    SKILL.md              # Required: skill definition
    references/           # Optional: additional documentation
      REFERENCE.md        # Detailed technical reference
      {topic}.md          # Domain-specific files
    scripts/              # Optional: executable scripts
      {script-name}.sh    # Bash scripts (preferred)
    assets/               # Optional: static resources
      templates/          # Document/config templates
      images/             # Diagrams, examples
```

### Naming Conventions

- **Skill directory**: kebab-case, must match `name` in frontmatter (e.g., `neon-postgres`)
- **Name field**: 1-64 chars, lowercase alphanumeric and hyphens only, no consecutive hyphens (`--`), must not start/end with `-`
- **SKILL.md**: Always uppercase, always this exact filename
- **Scripts**: `kebab-case.sh` (e.g., `deploy.sh`, `fetch-logs.sh`)

### SKILL.md Format

The `SKILL.md` file must contain YAML frontmatter followed by Markdown content.

#### Frontmatter (required fields)

```yaml
---
name: skill-name
description: A description of what this skill does and when to use it. Include trigger phrases. Max 1024 characters.
---
```

#### Frontmatter (optional fields)

```yaml
---
name: skill-name
description: A description of what this skill does and when to use it.
license: Apache-2.0
compatibility: Requires git, docker, and network access
metadata:
  author: example-org
  version: "1.0"
allowed-tools: Bash(git:*) Read
---
```

| Field           | Required | Description                                                                      |
| --------------- | -------- | -------------------------------------------------------------------------------- |
| `name`          | Yes      | Max 64 chars. Lowercase, numbers, hyphens. Must match directory name.            |
| `description`   | Yes      | Max 1024 chars. What the skill does and when to use it.                          |
| `license`       | No       | License name or reference to bundled license file.                               |
| `compatibility` | No       | Max 500 chars. Environment requirements (system packages, network access, etc.). |
| `metadata`      | No       | Arbitrary key-value mapping for additional metadata.                             |
| `allowed-tools` | No       | Space-delimited list of pre-approved tools. (Experimental)                       |

#### Body content

The Markdown body contains skill instructions. Recommended sections:

- Step-by-step instructions
- Examples of inputs and outputs
- Common edge cases

```markdown
# {Skill Title}

{Brief description of what the skill does.}

## How It Works

{Numbered list explaining the skill's workflow}

## Usage

{Instructions for using the skill, including any script invocations}

## References

See [the reference guide](references/REFERENCE.md) for detailed documentation.
```

### Best Practices for Context Efficiency

Skills are loaded on-demand — only the skill name and description are loaded at startup. The full `SKILL.md` loads into context only when the agent decides the skill is relevant. To minimize context usage:

- **Keep SKILL.md under 500 lines** — put detailed reference material in `references/`
- **Write specific descriptions** — helps the agent know exactly when to activate the skill
- **Use progressive disclosure** — reference supporting files that get read only when needed
- **Prefer scripts over inline code** — script execution doesn't consume context (only output does)
- **File references work one level deep** — link directly from SKILL.md to supporting files

### Optional Directories

#### references/

Contains additional documentation that agents can read when needed. Keep files focused — agents load these on demand, so smaller files mean less context usage.

See: https://agentskills.io/specification#references

#### scripts/

Contains executable code that agents can run. Scripts should:

- Use `#!/bin/bash` shebang
- Use `set -e` for fail-fast behavior
- Write status messages to stderr: `echo "Message" >&2`
- Write machine-readable output (JSON) to stdout
- Include a cleanup trap for temp files

#### assets/

Contains static resources like templates, images, and data files.

### End-User Installation

**Claude Code:**

```bash
cp -r skills/{skill-name} ~/.claude/skills/
```

**claude.ai:**
Add the skill to project knowledge or paste SKILL.md contents into the conversation.

If the skill requires network access, instruct users to add required domains at `claude.ai/settings/capabilities`.

### Validation

Use the skills-ref tool to validate your skills:

```bash
npm ci --ignore-scripts
npm run validate:skills
# or the full CI gate (skills + plugins):
npm run validate:ci
```

You can also validate a single skill directly:

```bash
skills-ref validate ./my-skill
```

## Plugins vendor real skill copies

The plugins under `plugins/` are distributed as git repositories, and Cursor/Claude silently drop symlinks that escape the plugin root on install. So each plugin ships **real copies** of its skills, not symlinks into the top-level `skills/`.

- The mapping of which skills each plugin vendors lives in the `PLUGIN_SKILLS` map in [`scripts/sync-plugin-skills.mjs`](scripts/sync-plugin-skills.mjs). A value of `"*"` vendors every skill under `skills/` (new skills ship automatically); an array vendors only the named skills.
- `npm run sync:plugins` regenerates the copies from `skills/`. A git pre-commit hook (wired by the `prepare` script on `npm install`) runs it automatically and stages the result.
- `npm run validate:plugin-skills` (part of `validate:ci`) fails if the vendored copies drift from the source or if any symlink reappears inside a plugin. The Cursor and Claude plugin validators also hard-error on any in-plugin symlink.

When you add or change a skill that a plugin ships, run `npm run sync:plugins` (or just commit — the hook handles it).

## CI/CD

Neon maintains **two** agent-skill repositories with a shared, hardened CI pipeline. Keep them aligned when you change CI/CD in either repo.

| Repo | GitHub | What CI validates |
| --- | --- | --- |
| **agent-skills** (this repo) | [neondatabase/agent-skills](https://github.com/neondatabase/agent-skills) | Every skill under `skills/` via `skills-ref`, plus Cursor and Claude plugin manifests under `plugins/` |
| **neon-for-agent-platforms** | [neondatabase/neon-for-agent-platforms](https://github.com/neondatabase/neon-for-agent-platforms) | Every skill under `skills/` via `skills-ref` |

Shared pipeline shape (both repos):

- Workflow: `.github/workflows/validate.yml` (job name **Validate**)
- Install: `npm ci --ignore-scripts` from `package-lock.json`
- Entry point: `npm run validate:ci`
- Supply chain: SHA-pinned GitHub Actions, exact-pinned npm dependencies (`save-exact=true` in `.npmrc`, no ranges and no unpinned `npx`), `package-lock.json` resolving from `registry.npmjs.org`, `harden-runner` egress audit, Dependabot for `github-actions` + `npm`

**Repo-specific (keep — do not drop when aligning):** this repo also validates the Cursor and Claude **plugin manifests** under `plugins/`. That's why `validate:ci` here is `validate:plugins && validate:skills` (vs. skills-only in `neon-for-agent-platforms`) and why this workflow also filters on `plugins/**`. Alignment means matching the shared shape above, **not** stripping this repo's plugin checks.

**When you change CI/CD here** — workflow triggers, install hardening, `skills-ref` pinning, Dependabot config, or validate scripts — **apply the same change to [neondatabase/neon-for-agent-platforms](https://github.com/neondatabase/neon-for-agent-platforms)**, preserving each repo's intentional differences (this repo's plugin validation and `plugins/**` path filter).
