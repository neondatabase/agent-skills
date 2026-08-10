# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, etc.) when working with code in this repository.

For the complete Agent Skills specification, see: https://agentskills.io/specification

## Repository Overview

A collection of skills for coding agents for working with Neon. Skills are packaged instructions and documentation that extend the agent's capabilities.

## The repo root is a portable Agent Plugins v1 package

The root [`plugin.json`](plugin.json) and [`mcp.json`](mcp.json) make this repository directly installable by any client that implements the [Agent Plugins v1 specification](https://agent-plugins.org/specification). Everything the portable format defines lives at the root: the manifest, the MCP configuration, and the skills as immediate children of `skills/`.

Rules to keep in mind when touching these files:

- The `plugin.json` schema is **closed**. Only `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, and `extensions` are allowed. Client fields such as `skills`, `mcpServers`, `hooks`, or `logo` are nonconforming at the top level — MCP servers go in `mcp.json`, skills are discovered from `skills/`, and anything else client-specific goes under a reverse-domain `extensions` namespace owned by the client.
- `mcp.json` transports are `stdio`, `streamable-http`, or `sse`. Note that this differs from `plugins/neon-postgres/mcp.json`, which uses Claude/Cursor's `http` spelling; the two files are intentionally not identical.
- Only immediate children of `skills/` are discovered, and each `SKILL.md` frontmatter `name` must match its directory.
- Hooks, agents, commands, LSP servers, and the `marketplace.json` catalogs are **not** portable v1 components. Hooks and the rest belong inside a plugin under `plugins/`; the catalogs stay at the repo root in `.claude-plugin/` and `.cursor-plugin/`, where Claude Code and Cursor look for them, and point back into `plugins/`. v1 only claims `plugin.json`, `mcp.json`, and `skills/`, so conforming clients ignore those extra root directories.
- [`kimi.plugin.json`](kimi.plugin.json) is Kimi Code's own manifest and is not a v1 component either, so the closed-schema rule above does not apply to it. It declares `skills` and `mcpServers` inline — nonconforming at the top level of a v1 manifest, but necessary because Kimi does not read `mcp.json` — and it points at the same `skills/` directory, so it needs no vendoring. Conforming v1 clients ignore it, the same way they ignore the catalogs.

`npm run validate:agent-plugin` (part of `validate:ci`) enforces the manifest, MCP, and skill-discovery rules above. The last two bullets are packaging conventions rather than checked rules, though `validate:versions` does hold `kimi.plugin.json` to the version in `package.json` like every other manifest.

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
# or the full CI gate:
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

The root Agent Plugins package is the exception: it reads `skills/` directly, so it needs no vendoring and no sync step.

## Releasing: bump package.json

[`package.json`](package.json) holds the plugin version. Every other manifest that declares one is **generated** from it, the same way `plugins/*/skills` is generated from `skills/`:

| File | Field |
| --- | --- |
| [`plugin.json`](plugin.json) | `version` |
| [`kimi.plugin.json`](kimi.plugin.json) | `version` |
| [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) | `metadata.version` and `plugins[].version` |
| [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json) | `metadata.version` |
| [`plugins/neon-postgres/.claude-plugin/plugin.json`](plugins/neon-postgres/.claude-plugin/plugin.json) | `version` |
| [`plugins/neon-postgres/.cursor-plugin/plugin.json`](plugins/neon-postgres/.cursor-plugin/plugin.json) | `version` |

So a release is one edit:

```bash
npm version patch --no-git-tag-version   # or minor / major
git commit -am "Release the accumulated skill changes"
```

The pre-commit hook runs `npm run sync:versions` and stages the rewritten manifests. `npm run validate:versions` is the same script in `--check` mode and runs as part of `validate:ci`, so a manifest edited by hand, or a commit made with the hook bypassed, still fails the build. When it does, the failure names its own fix: `npm run sync:versions` for a stale manifest, `npm install --ignore-scripts` for the lockfile below, and a hand edit for a manifest that has lost its `version` field.

Do not edit those version fields directly — the hook will overwrite them from `package.json` on the next commit.

`package-lock.json` carries the version too, in `version` and `packages[""].version`. `npm version` updates it and `git commit -a` stages it, so it is **checked but never written**: rewriting it by text match is unsafe because it repeats `"version"` for every dependency. If it drifts, run `npm install --ignore-scripts`, which rewrites it from `package.json`. Reach for that rather than editing it, because `npx` can quietly restore the old version from `node_modules/.package-lock.json`.

The table is what the manifests happen to declare today, not a contract. [`scripts/sync-versions.mjs`](scripts/sync-versions.mjs) syncs whichever version fields a file already has and picks up any new directory under `plugins/` automatically — so adding a `version` to a catalog's plugin entry silently brings it into the set. A file that exists but declares no version at all is an error, so a deleted field cannot pass as "in sync".

The rewrite is a surgical text replacement rather than a JSON re-serialize, so each file's formatting survives untouched. Every file is re-parsed and compared before anything is written, and nothing is written unless all of them verify.

## CI/CD

Neon maintains **two** agent-skill repositories with a shared, hardened CI pipeline. Keep them aligned when you change CI/CD in either repo.

| Repo | GitHub | What CI validates |
| --- | --- | --- |
| **agent-skills** (this repo) | [neondatabase/agent-skills](https://github.com/neondatabase/agent-skills) | Every skill under `skills/` via `skills-ref` and its reference graph, plus the root Agent Plugins v1 package, both marketplace catalogs and plugin manifests, the vendored plugin skills, and every manifest version against `package.json` |
| **neon-for-agent-platforms** | [neondatabase/neon-for-agent-platforms](https://github.com/neondatabase/neon-for-agent-platforms) | Every skill under `skills/` via `skills-ref` |

Shared pipeline shape (both repos):

- Workflow: `.github/workflows/validate.yml` (job name **Validate**)
- Install: `npm ci --ignore-scripts` from `package-lock.json`
- Entry point: `npm run validate:ci`
- Supply chain: SHA-pinned GitHub Actions, exact-pinned npm dependencies (`save-exact=true` in `.npmrc`, no ranges and no unpinned `npx`), `package-lock.json` resolving from `registry.npmjs.org`, `harden-runner` egress audit, Dependabot for `github-actions` + `npm`

**Repo-specific (keep — do not drop when aligning):** this repo also validates the root **Agent Plugins v1 package** and the Cursor and Claude **plugin manifests** under `plugins/`. That's why `validate:ci` here is `validate:agent-plugin && validate:plugins && validate:versions && validate:skills && validate:references` (vs. skills-only in `neon-for-agent-platforms`) and why this workflow also filters on `plugins/**`, `plugin.json`, `mcp.json`, `kimi.plugin.json`, `.claude-plugin/**`, and `.cursor-plugin/**`. Do not drop the last three: the Kimi manifest and the two catalogs hold four of the synced version fields between them, so losing one of those filters would let a version-bearing change skip `validate:versions`. Alignment means matching the shared shape above, **not** stripping this repo's plugin checks.

**When you change CI/CD here** — workflow triggers, install hardening, `skills-ref` pinning, Dependabot config, or validate scripts — **apply the same change to [neondatabase/neon-for-agent-platforms](https://github.com/neondatabase/neon-for-agent-platforms)**, preserving each repo's intentional differences (this repo's plugin validation and `plugins/**` path filter).

`neon-for-agent-platforms` has no `plugins/` directory and no root `plugin.json` yet, so `validate:agent-plugin`, `validate:versions`, and the `plugin.json`/`mcp.json`/`kimi.plugin.json` path filters do **not** port over as-is. Giving that repo its own portable manifest is a follow-up; until then, this is an intentional difference rather than drift.
