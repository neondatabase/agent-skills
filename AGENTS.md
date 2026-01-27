# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, etc.) when working with code in this repository.

For the complete Agent Skills specification, see: https://agentskills.io/specification

## Repository Overview

A collection of skills for coding agents for working with Neon Serverless Postgres. Skills are packaged instructions and documentation that extend the agent's capabilities.

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
skills-ref validate ./my-skill
```
