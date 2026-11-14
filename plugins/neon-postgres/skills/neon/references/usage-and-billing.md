# Usage and Billing: Track Consumption on Free and Paid Plans

How to answer "how much have I used?" and "what will this cost?" for a Neon project or organization. The right tool depends on the organization's plan: the consumption history API is **paid plans only** (Launch, Scale, Agent, Enterprise) and returns HTTP 403 on Free, so check the plan first.

## Contents

- [Find the plan](#find-the-plan)
- [Free plan: current-period totals](#free-plan-current-period-totals)
- [Paid plans: consumption history](#paid-plans-consumption-history)
- [Convert raw values and estimate cost](#convert-raw-values-and-estimate-cost)
- [Alerts and hard caps](#alerts-and-hard-caps)
- [What the API does not expose](#what-the-api-does-not-expose)
- [Gotchas](#gotchas)

## Find the plan

```bash
neon orgs list -o json        # each org has a "plan": free, launch, scale, ...
```

With MCP, `describe_project` returns `owner.subscription_type` (for example `free_v3`). Anything that starts with `free` is the Free plan. To find which org a project belongs to, read `org_id` from `neon projects get <project_id> -o json` (no `--org-id` needed).

| Plan                             | Use                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Free                             | Project details: `neon projects get <project_id> -o json`, MCP `describe_project`, or `GET /projects/{project_id}`          |
| Launch, Scale, Agent, Enterprise | Consumption history v2: MCP `get_project_consumption` / `get_branch_consumption`, or `neon api /consumption_history/v2/...` |

Project details also work on paid plans for a quick current-month check, but they are approximate. Use consumption history for anything billing-related.

## Free plan: current-period totals

The project record carries running totals for the current billing period. They reset at `consumption_period_start`, update about every 15 minutes, and can lag up to an hour.

```bash
neon projects get <project_id> -o json      # the default table output hides usage fields
```

| Field                                                 | Meaning                                                                                         | Free allowance                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------- |
| `compute_time_seconds`                                | CU-seconds this period (CPU time weighted by compute size). `/ 3600` = CU-hours                 | 100 CU-hours/project = `360000` |
| `active_time_seconds`                                 | Wall-clock seconds computes ran. `compute_time_seconds / active_time_seconds` = average CU size |                                 |
| `data_transfer_bytes`                                 | Network transfer (public and private combined). `/ 1e9` = GB                                    | 5 GB/project = `5000000000`     |
| `consumption_period_start` / `consumption_period_end` | Current billing period; allowances reset at the end                                             |                                 |

Report compute as a share of the allowance: `compute_time_seconds / 360000 * 100` percent.

**Storage** on Free is capped by branch logical size, not by a project field. Sum `logical_size` (bytes) across branches and compare with 1 GB/project (20 GB across the account). `branch_logical_size_limit_bytes` on the project shows the per-branch cap.

```bash
neon branches list --project-id <project_id> -o json    # each branch has logical_size
```

With MCP, use `list_branches`. Don't use the per-branch `compute_time_seconds` or `data_transfer_bytes` fields on branch records for usage: they can read `0` while the project total is non-zero. A per-branch breakdown needs the paid consumption API.

**What Free can and can't answer.** Free gives running totals for the current month only. Say so up front instead of searching for more:

| Question                                                        | On Free                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------- |
| How much compute or transfer this month, how close to the limit | Yes, from the project record                                         |
| Storage used                                                    | Yes, sum of branch `logical_size`                                    |
| Usage by day or hour, past months, trends                       | No history. Poll the project record and store snapshots to build one |
| Which branch is using the most                                  | No. Per-branch metrics need a paid plan                              |
| Public vs private transfer, root vs child storage               | No. Combined totals only                                             |
| Functions, Object Storage, or Auth usage                        | No API. Neon Console only                                            |
| Spend alerts or caps                                            | No. Spending notifications are Launch and Scale only                 |

When the user needs a "No" row, point them to the Neon Console project **Overview** > **Usage** panel, or note that upgrading to Launch (no monthly minimum) unlocks the consumption history API.

When a Free project has already run out of compute or transfer (SQLSTATE `53000`, HTTP `402`), the `neon-postgres` skill's Free Plan Limits section covers restoring service.

## Paid plans: consumption history

`GET /api/v2/consumption_history/v2/projects` (per project) and `/consumption_history/v2/branches` (per branch) return metrics that match the invoice. History starts when the organization upgraded.

**MCP:** `get_project_consumption` (per project, `org_id` required) or `get_branch_consumption` (per branch, `project_ids` required). Both return every page.

**CLI:** no dedicated command; use the authenticated passthrough. Month to date, daily buckets, with `to` set to tomorrow:

```bash
neon api /consumption_history/v2/projects \
  -Q org_id=<org_id> \
  -Q from=2026-11-01T00:00:00Z -Q to=2026-11-14T00:00:00Z \
  -Q granularity=daily -Q limit=100 \
  -Q metrics=compute_unit_seconds,root_branch_bytes_month,child_branch_bytes_month,public_network_transfer_bytes,extra_branches_month
```

Required: `org_id`, `from`, `to`, `granularity` (`hourly`, `daily`, `monthly`), `metrics`. Optional: `project_ids` (up to 100), `limit` (projects per page, default **10**, max 100), `cursor`. Unlike the MCP tools, the CLI returns one page: while the response has `pagination.cursor`, repeat the call with `-Q cursor=<value>` and the same other parameters, and sum across pages. `neon api <path> --describe` prints the endpoint's parameters (`--help` prints generic CLI help).

| Metric                                    | Raw unit              | Project endpoint | Branch endpoint |
| ----------------------------------------- | --------------------- | ---------------- | --------------- |
| `compute_unit_seconds`                    | CU-seconds            | yes              | yes             |
| `root_branch_bytes_month`                 | byte-months           | yes              | yes             |
| `child_branch_bytes_month`                | byte-months           | yes              | yes             |
| `instant_restore_bytes_month`             | byte-months           | yes              | yes             |
| `snapshot_storage_bytes_month`            | byte-months           | yes              | no              |
| `public_network_transfer_bytes`           | bytes                 | yes              | yes             |
| `private_network_transfer_bytes`          | bytes                 | yes              | yes             |
| `extra_branches_month`                    | branch-hours          | yes              | no              |
| `functions_active_capacity_microseconds`  | capacity-microseconds | yes              | yes             |
| `functions_waiting_capacity_microseconds` | capacity-microseconds | yes              | yes             |
| `functions_invocations`                   | invocations           | yes              | yes             |
| `functions_egress_bytes`                  | bytes                 | yes              | yes             |

Lookback per granularity, measured from now: `hourly` 168 hours, `daily` 60 days, `monthly` 12 months. Outside it the API returns `406`. Use `hourly` for the closest invoice match and `daily` for month-to-date reports.

Polling: data refreshes about every 15 minutes, so poll no more often than that. The consumption endpoints share a rate limit of about 50 requests per minute per account (`429` when exceeded). Calling them does not wake suspended computes.

For fleets of projects (agent platforms), the `neon-postgres-agent-platforms` skill covers org-wide polling and per-tenant metering.

## Convert raw values and estimate cost

Neon uses decimal GB (1 GB = 10^9 bytes) and a fixed 744-hour billing month.

| Raw unit              | Billing unit        | Formula        |
| --------------------- | ------------------- | -------------- |
| CU-seconds            | CU-hours            | `/ 3600`       |
| byte-months           | GB-months           | `/ 1e9`        |
| bytes                 | GB                  | `/ 1e9`        |
| branch-hours          | branch-months       | `/ 744`        |
| capacity-microseconds | Capacity-Hours      | `/ 3600000000` |
| invocations           | million invocations | `/ 1e6`        |

Rates and allowances as of November 2026. Confirm against [Neon plans](https://neon.com/docs/introduction/plans.md) before quoting a price.

| Item                      | Free                              | Launch                                   | Scale                                    |
| ------------------------- | --------------------------------- | ---------------------------------------- | ---------------------------------------- |
| Compute                   | 100 CU-hours/project              | $0.106/CU-hour                           | $0.222/CU-hour                           |
| Storage (root and child)  | 1 GB/project, 20 GB account total | $0.35/GB-month                           | $0.35/GB-month                           |
| Instant restore           | No charge, up to 6 hours          | $0.20/GB-month                           | $0.20/GB-month                           |
| Snapshots                 | 1 manual snapshot                 | $0.09/GB-month                           | $0.09/GB-month                           |
| Public network transfer   | 5 GB/project                      | 500 GB/project included, then $0.10/GB   | 500 GB/project included, then $0.10/GB   |
| Private network transfer  | Not available                     | Not available                            | $0.01/GB                                 |
| Extra branches            | Not available (10/project)        | $1.50/branch-month (10/project included) | $1.50/branch-month (25/project included) |
| Functions active compute  | 10 Capacity-Hours/project         | $0.10/Capacity-Hour                      | $0.12/Capacity-Hour                      |
| Functions waiting compute | 400 Capacity-Hours/project        | $0.025/Capacity-Hour                     | $0.03/Capacity-Hour                      |
| Functions invocations     | 1M/project                        | $0.60/million                            | $0.60/million                            |
| Object Storage            | 5 GB/project                      | $0.023/GB-month                          | $0.023/GB-month                          |
| AI Gateway                | Prepaid credits                   | Prepaid credits                          | Prepaid credits                          |

Agent plan rates match Scale, except compute at the Launch rate ($0.106/CU-hour). Enterprise matches Scale unless negotiated. Launch and Scale have no base fee or monthly minimum: the bill is the sum of metered usage, and invoices under $0.50 are not collected.

Allowances to subtract before multiplying:

- **Public transfer:** per project, `max(0, project_GB - 500)`, then sum.
- **Extra branches:** `extra_branches_month` counts **all** child branches. Per project and per time bucket, subtract `(branches_per_project - 1) x hours_in_bucket` (9 on Launch, 24 on Scale), floor at 0, sum, then divide by 744.

Example: `compute_unit_seconds` of `500000` on Scale is `500000 / 3600 = 138.89` CU-hours, and `138.89 x $0.222 = $30.83`. Full worked examples: [Usage and cost calculations](https://neon.com/docs/introduction/usage-calculations.md).

To project a month-end figure, scale the month-to-date total by days in the month over days elapsed, and say it assumes usage continues at the same rate.

## Alerts and hard caps

- **Spending notifications** (Launch and Scale): email org admins at 80% and 100% of a monthly dollar threshold. Alerts only; usage continues.

  ```bash
  neon orgs spending-limit get --org-id <org_id>
  neon orgs spending-limit set 500 --org-id <org_id>   # US dollars
  neon orgs spending-limit delete --org-id <org_id>
  ```

  Members with read access can `get`; only org admins can `set` or `delete`. On Free the command errors with "Spending limits are only available for Launch and Scale plans." API: `/organizations/{org_id}/billing/spending_limit` with `spending_limit_cents`.

- **Per-project quotas:** hard caps that suspend the project's computes until the next billing period (they do not wake on connection like scale to zero). Set `settings.quota` with `active_time_seconds`, `compute_time_seconds`, `written_data_bytes`, `data_transfer_bytes`, or per-branch `logical_size_bytes` on create or update:

  ```bash
  neon api /projects/<project_id> -X PATCH \
    -d '{"project":{"settings":{"quota":{"compute_time_seconds":108000}}}}'
  ```

  See [Configure consumption limits](https://neon.com/docs/guides/consumption-limits.md).

## What the API does not expose

- **Free plan Functions, Object Storage, and Auth MAU usage:** no API field today. Send the user to the Neon Console.
- **Object Storage bytes on paid plans:** not a consumption history metric. It appears on the **Billing** page.
- **AI Gateway credit balance:** Console only, under **Billing** > **AI gateway credits**. Balances show in whole cents. See [AI Gateway prepaid credits](https://neon.com/docs/ai-gateway/prepaid-credits.md).
- **Invoices and charges to date:** Console **Billing** page. Project-level Compute, Storage, History, and Network transfer also appear in the **Usage** panel on the project's **Overview** page (about an hour behind).

## Gotchas

- `granularity=monthly` rounds `from` and `to` down to the month start. For the current month, set `to` to the first of next month (a future `to` is accepted), or the API rejects the range because `from` equals `to`. For month to date, `daily` with `to` set to tomorrow is simpler.
- Metrics with a zero value are omitted from a bucket's `metrics` array, and buckets with no usage are omitted from `consumption`. Treat anything missing as `0`.
- Results include deleted projects. Projects with no usage in the range come back with empty `periods`.
- `neon projects list` does not carry the usage fields. Call `neon projects get <project_id> -o json` (or MCP `describe_project`) per project.
- An empty `projects` array can mean the caller has no org-level read access (for example, a project collaborator), not zero usage. Spending-limit calls fail outright with a permission error in that case.
- Project-detail fields are approximate and not for billing; on paid plans the legacy `/consumption_history/projects` endpoint does not match the invoice either. Use `/consumption_history/v2/...`.
