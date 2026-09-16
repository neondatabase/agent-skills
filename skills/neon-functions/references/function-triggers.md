# Function Triggers

A Function Trigger is a branch-scoped rule that POSTs to a Neon Function so recurring work does not need a separate scheduler. The request is a normal `fetch` invocation: same public URL, same 15-minute time-to-first-byte limit, same injected env (`DATABASE_URL`, …).

Beta. Same regions as Functions: `us-east-2` and `eu-central-1`. Needs Neon CLI 4.17 or newer to declare triggers in `neon.ts`.

If `neon deploy` returns 404 `function triggers not available for this project`, the project does not have Function Triggers yet. Deploy the function without applying the trigger (`neon functions deploy <slug> --src <entry>`) and retry `neon deploy` once the project has them.

## Supported types

The shipped type is `schedule` only: `@neon/config` 1.5.0 `FunctionScheduleTriggerDef`, Neon CLI 4.18.0 `neon triggers create --cron`, `@neon/sdk` Triggers v1, Neon MCP `create_trigger` (`type` enum: `schedule`), `@neon/functions` 0.10.0 `TriggerInvocation = ScheduleTriggerInvocation`.

| `type`     | When it fires                       | Declare in `neon.ts` | CLI create                        |
| ---------- | ----------------------------------- | -------------------- | --------------------------------- |
| `schedule` | On a five-field UTC cron expression | `triggers[]`         | `neon triggers create --cron '…'` |

`@neon/functions` parses any other `trigger.type` as `invalid_body`.

## `schedule`

Neon POSTs to `functionPath` (default `/`) at each cron tick.

| Field          | Required | Notes                                                                       |
| -------------- | -------- | --------------------------------------------------------------------------- |
| `type`         | yes      | `"schedule"`                                                                |
| `name`         | yes      | Unique among every trigger visible on the branch, including other functions |
| `cron`         | yes      | Five-field UTC expression, e.g. `0 * * * *`, `*/15 * * * *`                 |
| `functionPath` | no       | Path on the function. Default `/`. CLI flag: `--function-path`              |
| `enabled`      | no       | Default `true`. CLI: `--enabled false` to create disabled                   |

## neon.ts (preferred)

Declare triggers on the function. `neon deploy` applies them **after** the function is deployed. Triggers that exist remotely but are omitted from `neon.ts` are left alone.

```typescript
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
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
            functionPath: "/cron",
          },
        ],
      },
    },
  },
});
```

```bash
neon deploy
```

Change the cron string and deploy again to reschedule. Starter: `neon bootstrap --template cron-job`.

## CLI

Use when you are not applying `neon.ts`, or to list, enable, disable, or delete.

```bash
neon triggers create --function-slug cron --name hourly --cron '0 * * * *' --function-path /cron
neon triggers list
neon triggers list --output json
neon triggers update <id> --branch <branch> --cron '*/30 * * * *'
neon triggers enable <id> --branch <branch>
neon triggers disable <id> --branch <branch>
neon triggers delete <id> --branch <branch>
```

`enable` / `disable` wrap `update --enabled`. Updating the cron recomputes `Next Run At`. Disabling clears `Next Run At`. Alias: `neon trigger`.

Inspect a trigger with `neon triggers list --output json` (`trigger_id`, `schedule.cron`, `function_path`, `enabled`, `inherited`, `next_run_at`). Pass `--branch` on get/update/enable/disable/delete: without it the CLI resolves the trigger id as a branch name.

Project and branch otherwise resolve from `--project-id` / `--branch`, then `.neon`, then a single-project auto-detect.

## MCP backup

The Neon MCP server (`?category=functions`) exposes `list_triggers`, `get_trigger`, `create_trigger`, `update_trigger`, and `delete_trigger`. `branch_id` is a `br-…` id, not a branch name (`list_branches` to resolve). Create body is snake_case:

```json
{
  "type": "schedule",
  "function_slug": "cron",
  "name": "hourly",
  "function_path": "/cron",
  "schedule": { "cron": "0 * * * *" },
  "enabled": true
}
```

`create_trigger` required fields: `type`, `function_slug`, `name`, `schedule`. REST is the same payload at `POST /projects/{project_id}/branches/{branch_id}/triggers`. CLI docs: https://neon.com/docs/cli/triggers.md.

## Delivery payload

Neon POSTs JSON. The Functions proxy drops client-supplied `x-neon-*` headers, so a present `x-neon-trigger-invocation-id` is from a trigger delivery. It must match `invocation_id` in the body.

Wire JSON (snake_case):

```json
{
  "version": 1,
  "invocation_id": "…",
  "trigger": {
    "type": "schedule",
    "id": "trigger-…",
    "name": "hourly"
  },
  "data": { "scheduled_at": "2026-09-15T23:35:00Z" }
}
```

Parsed (`@neon/functions` ≥ 0.10.0) is camelCase: `invocationId`, `trigger.id`, `trigger.name`, `trigger.type` (`"schedule"`), `data.scheduledAt`.

### `parseTrigger` (Hono)

Throws `HTTPException`. `c.req.json()` still works afterwards.

| Failure                  | Status | Message                                       |
| ------------------------ | ------ | --------------------------------------------- |
| missing header           | 401    | `Missing x-neon-trigger-invocation-id header` |
| header ≠ `invocation_id` | 401    | `Invocation id mismatch`                      |
| invalid JSON or payload  | 400    | `Invalid trigger payload`                     |

```typescript
import { parseTrigger } from "@neon/functions/hono";

app.post("/cron", async (c) => {
  const invocation = await parseTrigger(c);
  return c.json({ ok: true, invocationId: invocation.invocationId });
});
```

### `parseTriggerInvocation` (`fetch`)

```typescript
import { parseTriggerInvocation } from "@neon/functions/triggers";

export default {
  async fetch(request: Request): Promise<Response> {
    const parsed = await parseTriggerInvocation(request);
    if (!parsed.ok) {
      const status = parsed.error === "invalid_body" ? 400 : 401;
      return new Response(parsed.error, { status });
    }
    return Response.json({
      ok: true,
      invocationId: parsed.invocation.invocationId,
    });
  },
};
```

`parseTriggerInvocation(request)` clones the Request before `json()`, so `request.json()` still works. If you already have the body: `parseTriggerInvocation({ headers, body })` (sync). `parsed.error` is `missing_header`, `invalid_body`, or `invocation_id_mismatch`.

## Local `neon dev`

`neon dev` forwards `x-neon-trigger-invocation-id`, so you can simulate a tick:

```bash
curl -X POST http://localhost:8787/cron \
  -H 'content-type: application/json' \
  -H 'x-neon-trigger-invocation-id: local-dev' \
  -d '{
    "version": 1,
    "invocation_id": "local-dev",
    "trigger": { "type": "schedule", "id": "trigger-local", "name": "hourly" },
    "data": { "scheduled_at": "2026-09-15T00:00:00Z" }
  }'
```

A public POST to the **deployed** function that includes that header still returns 401: the proxy strips client `x-neon-*` headers.

## Inheritance

Triggers are branch-scoped. A trigger created on a parent is visible on children (`inherited: true`, `source_branch_id` points at the origin). It stays disabled on the child until `neon triggers enable`.

## Logs

```bash
neon logs query --source function --since 1h
```

Pass `--branch` when the function is not on the branch in `.neon`.
