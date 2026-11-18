# Neon Functions in `neon.ts`

## Neon Infrastructure as Code (`neon.ts`)

The `functions` block from [Setup](../SKILL.md#setup) is part of `neon.ts`, Neon's infrastructure-as-code file — one TypeScript file declares every function (its `source`, display `name`, and `env`) alongside any other branch services, in version control (see the `neon` skill for the full reference). Treat it like Terraform for your branch:

```bash
neon config status   # print the branch's live config (deployed functions)
neon config plan     # dry-run diff of what apply would change
neon config apply --env <file>  # bundle + deploy the declared functions  (neon deploy is an alias; pass --env when Function env reads process.env)
```

Functions are **branch-scoped**: each branch runs its own deployment at its own URL. When a `neon.ts` is present, `neon checkout` applies the policy as it _creates_ a branch. Pass `--env <file>` on that create when Function env reads `process.env`. Checking out an _existing_ branch doesn't redeploy — run `neon deploy --env <file>` to apply changes.

Per-branch deploy tuning (e.g. `runtime`) lives in the `branch` closure, keyed by slug, so it can vary by branch without changing which functions exist:

```typescript
export default defineConfig({
  functions: { todos: { name: "todo api", source: "src/index.ts" } },
  branch: (branch) => ({
    functions: { todos: { runtime: "nodejs24" } },
  }),
});
```
