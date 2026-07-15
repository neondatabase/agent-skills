# Contributing

Thanks for contributing to the Neon Agent Skills!

## Source of truth

The top-level `skills/` directory is the source of truth. Plugin folders under `plugins/` symlink only the skill directories they expose.

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
