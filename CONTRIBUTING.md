# Contributing

Thanks for contributing to the Neon Agent Skills!

## Source of truth

The top-level `skills/` directory is the source of truth. Plugin folders under `plugins/` ship **real copies** of the skill directories they expose (not symlinks — Cursor and Claude silently drop symlinks that escape the plugin root when a plugin is installed from git).

Which skills each plugin vendors is declared in the `PLUGIN_SKILLS` map in [`scripts/sync-plugin-skills.mjs`](scripts/sync-plugin-skills.mjs). A value of `"*"` means "all skills under `skills/`", so new skills are vendored automatically without editing the map; you can also list specific skill names instead. To regenerate the copies after editing a skill or the map:

```bash
npm run sync:plugins
```

A git pre-commit hook (installed via the `prepare` script when you run `npm install`) runs this automatically and stages the result, so you never have to copy skills by hand. CI runs `npm run validate:plugin-skills` (part of `validate:ci`) to fail the build if the vendored copies drift from the source or if any symlink sneaks back into a plugin.

## Keep downstream marketplaces in sync

The Neon skills are also published as plugins in external marketplaces that **vendor their own copies** of the skill files. Changes here do **not** propagate automatically. Whenever you add or change a skill, open a PR in each downstream marketplace to mirror the change:

| Marketplace | Repo | Neon plugin path | Our fork |
| --- | --- | --- | --- |
| OpenAI | [`openai/plugins`](https://github.com/openai/plugins) | `plugins/neon-postgres/` | `andrelandgraf/plugins` |
| Grok (xAI) | [`xai-org/plugin-marketplace`](https://github.com/xai-org/plugin-marketplace) | `external_plugins/neon/` | `andrelandgraf/plugin-marketplace` |

Each marketplace has its own packaging and validation steps — follow that repo's contributing guide when opening the mirror PR.

## Validation

Before opening a PR here, run:

```bash
npm ci --ignore-scripts
npm run validate:ci
```

This runs skill validation (`skills-ref` on every directory under `skills/`) and plugin manifest validation under `plugins/`. See `AGENTS.md` for the full CI/CD picture and the paired **neon-for-agent-platforms** repo.

## Dependency pinning

Every dependency is pinned to an exact version — no `^`, no `~`, no `latest`, and no unpinned `npx` invocations. `.npmrc` sets `save-exact=true`, so `npm install <pkg>` writes the exact version for you. Dependabot proposes the bumps; take them as PRs rather than widening a range.

The same rule covers GitHub Actions, which are pinned to a full commit SHA with the version in a trailing comment:

```yaml
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
```

`package-lock.json` must resolve tarballs from `https://registry.npmjs.org`. If your machine installs through a corporate npm mirror, check the diff before committing — a lockfile that points at a private host fails `npm ci` for everyone else and blocks Dependabot.
