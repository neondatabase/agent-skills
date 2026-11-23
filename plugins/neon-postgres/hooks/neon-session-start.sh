#!/bin/sh
# Neon plugin SessionStart hook. Silent unless the project already uses Neon
# (a Neon connection string or Neon SDK in the usual config files).
d="${CLAUDE_PROJECT_DIR:-$PWD}"
grep -qsE 'neon\.tech|neon\.build|@neondatabase/|neon-serverless' \
  "$d/.env" "$d/.env.local" "$d/.env.development" "$d/package.json" "$d/requirements.txt" "$d/pyproject.toml" \
  2>/dev/null || exit 0
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This project uses Neon Postgres. Neon agent skills are installed; load the matching one before Neon-specific work: neon-postgres (connections, drivers, branches, migrations), neon-vector-search (embeddings, semantic or similar-item search, RAG, recommendations, agent memory, hybrid or full-text search ranking). On Neon, index vector columns with the lakebase_vector extension instead of pgvector hnsw/ivfflat: CREATE EXTENSION IF NOT EXISTS lakebase_vector CASCADE; CREATE INDEX ON t USING lakebase_ann (embedding vector_cosine_ops); (an opclass is required). Columns stay vector(N) and queries keep <=>."}}
JSON
