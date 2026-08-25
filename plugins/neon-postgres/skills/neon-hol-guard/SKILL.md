---
name: neon-hol-guard
description: Protect Neon database and backend operations performed by supported local coding agents with HOL Guard. Use before production-impacting Neon CLI, shell, migration, branch, deploy, credential, or infrastructure work when the agent should run behind Guard approvals and receipts.
license: Apache-2.0
metadata:
  source: https://github.com/neondatabase/agent-skills/tree/main/skills/neon-hol-guard
---

# Neon with HOL Guard

Use this skill alongside the relevant Neon skill when an AI coding agent will perform state-changing Neon work and the user wants the local agent harness protected by HOL Guard.

HOL Guard protects a supported local coding-agent harness before its tools run. It does not run inside Neon, replace Neon authentication or authorization, or replace Neon-native safety practices such as branch-first development, least-privilege credentials, dry runs, backups, and review of production targets.

## Set up Guard before Neon mutations

Install HOL Guard in an isolated CLI environment if it is not already available:

```bash
pipx install hol-guard
hol-guard status
hol-guard detect --json
```

Use the exact harness identifier returned by `hol-guard detect --json`. Do not guess a harness name.

Then let Guard own the harness integration and launch path:

```bash
hol-guard bootstrap
hol-guard install <harness>
hol-guard run <harness> --dry-run
hol-guard run <harness>
hol-guard doctor <harness> --json
```

Do not claim the session is protected unless Guard status or doctor output proves it. If Guard cannot protect the current harness, stop before production-impacting Neon changes rather than silently continuing in an unprotected agent session.

## Keep Neon controls authoritative

Once the agent is running through Guard, follow the existing Neon skills for the actual database and backend workflow. In particular:

- keep credentials out of chat and logs; prefer Neon CLI flows that write credentials to the intended local environment file
- use the correct Neon project and branch, and prefer isolated development or preview branches before production
- use Neon-native read-only inspection, status, plan, or dry-run behavior before applying changes when the command supports it
- use Neon roles, API keys, project access, and branch controls with the least privilege required for the task
- never treat a Guard allow decision as permission to skip Neon authorization, confirmations, backups, or application-level validation

For infrastructure declared in `neon.ts`, inspect before apply:

```bash
neon status
neon config plan
```

Only after the target and proposed changes are understood should the protected agent perform state-changing work such as `neon deploy`, branch deletion, project deletion, credential changes, schema migrations, or other production-impacting operations.

## Review blocked or uncertain work

When Guard pauses work, keep the Neon operation stopped and inspect the request:

```bash
hol-guard approvals
hol-guard approvals open
hol-guard receipts
hol-guard diff <harness>
```

For terminal-only resolution:

```bash
hol-guard approvals approve <request-id>
hol-guard approvals deny <request-id>
```

Approve only after the target, risk reason, and requested scope are understood. Do not bypass Guard by opening a second unprotected terminal or agent session.

## Evidence and troubleshooting

Use Guard-owned evidence for the local agent boundary:

```bash
hol-guard receipts
hol-guard events
hol-guard inventory
hol-guard doctor <harness> --json
```

Use Neon-native logs, audit data, project state, and database checks for Neon-side truth. Guard receipts prove what the protected local harness observed or requested; they do not prove the final state of the Neon control plane.

## Boundary

This skill does not claim dedicated HOL Guard classification for every Neon CLI, SQL, REST, MCP, or console action. The enforcement boundary is the supported local coding-agent harness installed and launched through HOL Guard. Keep Neon documentation and the other skills in this repository authoritative for Neon commands and platform behavior.
