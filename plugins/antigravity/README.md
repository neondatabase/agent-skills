# Neon plugin for Antigravity

This plugin gives Antigravity the Neon agent skills and the [Neon MCP Server](https://mcp.neon.tech), so your agent can build and manage a Neon backend: Lakebase Postgres, Auth, Realtime, Object Storage, Functions, the Data API, and AI Gateway.

## What's included

- `skills/`: the Neon agent skills.
- `mcp_config.json`: the Neon MCP Server.
- `.antigravity-plugin/plugin.json`: the Marketplace manifest.

## Install

```bash
agy plugin install https://github.com/neondatabase/agent-skills/tree/main/plugins/antigravity
```

Check that Antigravity found the plugin, its skills, and the MCP server:

```bash
agy plugin list
```

To sign in to the MCP server, run `/mcp` in Antigravity, select the Neon MCP server, and complete the OAuth flow.

## Source

The `skills/` and `assets/` directories are generated. The skills come from [`skills/`](https://github.com/neondatabase/agent-skills/tree/main/skills) at the repository root. Edit them there; the pre-commit hook runs `npm run sync:plugins` for you. See the [repository README](https://github.com/neondatabase/agent-skills#readme) for details.
