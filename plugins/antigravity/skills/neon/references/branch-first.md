# Branch-first dev flow in depth

### How checkout composes with neon.ts

When a `neon.ts` is present, `neon checkout <name> --create` applies your policy as it **creates** a branch, so a fresh branch comes up with its declared settings and services already in place. Pass `--env <file>` on that create so Function env that reads `process.env` resolves (`neon checkout feat --create --env .env.local`). Existing process env wins over the file. Checking out an _existing_ branch never reconciles it — apply config changes to it explicitly with `neon deploy --env <file>` (alias for `neon config apply`). `--update-existing` auto-confirms overriding remote settings; add it only after reviewing those changes. The bundled `env pull` also checks `neon.ts` against the linked branch and fails fast if the branch is missing a declared service, pointing you at `neon deploy --env <file>` to provision it, so your local env and the remote branch never drift apart silently.

### Opting out of local env vars

If env vars are injected at runtime instead of written to disk — or you simply don't want secrets in the working tree — pass `--no-env-pull` to `link` / `checkout` and supply the env another way:

- `neon-env run -- <your dev command>` (from `@neon/env`) injects the branch's vars at runtime.
- `neon-env export` prints dotenv or `--format json`.
- `fetchEnv` from `@neon/env` is the programmatic version.
- `neon dev` injects the same vars into the local Functions dev server.

When an agent should not write a local `.env`, instruct it (for example in your `AGENTS.md`) to run `neon checkout <branch> --no-env-pull` and rely on runtime injection.

For reading env you _already_ have on disk (typed and validated against your `neon.ts`), use `parseEnv` — see [Type-safe env vars with parseEnv](https://neon.com/docs/ai/skills/neon/references/parse-env.md).
