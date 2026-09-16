# Function Triggers (CLI, MCP, REST)

A Function Trigger is a branch-scoped rule that POSTs to a Neon Function on a schedule. Beta; same regions as Functions (`us-east-2`, `eu-central-1`). The only trigger type in the current CLI, `neon.ts` schema, OpenAPI spec, and `@neon/functions` parser is `schedule` (five-field UTC cron).

**Prefer `neon.ts`.** Declare triggers on the function. `neon deploy` applies them after the function is deployed. Names must be unique among every trigger visible on the branch. Triggers that exist remotely but are omitted from `neon.ts` are left alone; delete with `neon triggers delete`.

```typescript
preview: {
  functions: {
    cron: {
      name: "Cron Job",
      source: "src/index.ts",
      triggers: [
        {
          type: "schedule",
          name: "hourly",
          cron: "0 * * * *",
          functionPath: "/cron", // default "/"
          // enabled: true,
        },
      ],
    },
  },
}
```

Needs Neon CLI 4.17 or newer (`@neon/config` with the `triggers` field on a function).

**CLI** when you are not applying `neon.ts`, or to list, enable, disable, or delete:

```bash
neon triggers create --function-slug cron --name hourly --cron '0 * * * *' --function-path /cron
neon triggers list
neon triggers update <id> --branch <branch> --cron '*/30 * * * *'
neon triggers enable <id> --branch <branch>
neon triggers disable <id> --branch <branch>
neon triggers delete <id> --branch <branch>
```

Inspect a trigger with `neon triggers list --output json`. Pass `--branch` on get/update/enable/disable/delete: without it the CLI resolves the trigger id as a branch name. Inherited triggers (created on a parent branch) show `Inherited true` on the child and start disabled. `neon deploy` of a `neon.ts` that declares the same trigger enables that copy; omit it to leave the inherited trigger disabled.

**MCP backup** (Neon MCP server, `?category=functions`): `list_triggers`, `get_trigger`, `create_trigger`, `update_trigger`, `delete_trigger`. `create_trigger` takes `project_id`, `branch_id` (a `br-…` id, not a name), and `body` with `"type": "schedule"`, `function_slug`, `name`, and `schedule: { cron }`. REST if neither CLI nor MCP is available: `POST /projects/{project_id}/branches/{branch_id}/triggers` with the same body. CLI reference: https://neon.com/docs/cli/triggers.md.

The handler is still a normal `fetch`. Authenticate a trigger delivery with `parseTrigger` / `parseTriggerInvocation` from `@neon/functions` (≥ 0.10.0). Full type table, payload, and Hono example: the `neon-functions` skill, `references/function-triggers.md`.
