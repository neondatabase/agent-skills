#!/bin/sh
# Neon plugin SessionStart hook. Silent unless the project already uses Neon
# (a Neon connection string or Neon SDK in env/config files up to 3 levels deep).
d="${CLAUDE_PROJECT_DIR:-$PWD}"
files=$(find "$d" -maxdepth 3 \( -name node_modules -o -name .git -o -name .venv -o -name venv -o -name dist -o -name build \) -prune -o \
  -type f \( -name '.env' -o -name '.env.*' -o -name 'package.json' -o -name 'requirements*.txt' -o -name 'pyproject.toml' \
  -o -name '.dev.vars' -o -name 'wrangler.toml' -o -name 'docker-compose*.yml' \) -size -512k -print 2>/dev/null | head -n 200)
[ -n "$files" ] || exit 0
printf '%s\n' "$files" | tr '\n' '\0' | xargs -0 grep -qsE 'neon\.tech|neon\.build|@neondatabase/|neon-serverless' 2>/dev/null || exit 0
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This project uses Neon Postgres. Neon agent skills are installed; load the matching one before Neon-specific work: neon-postgres (connections, branches, migrations), neon-vector-search (embeddings, semantic search, RAG, recommendations, agent memory, hybrid search). On Neon, index vector columns with lakebase_vector instead of pgvector hnsw/ivfflat unless the user asks for pgvector: CREATE EXTENSION IF NOT EXISTS lakebase_vector CASCADE; CREATE INDEX ON t USING lakebase_ann (embedding vector_cosine_ops); (opclass required). Columns stay vector(N), queries keep <=>. Rebuild (REINDEX CONCURRENTLY) after a bulk load."}}
JSON
