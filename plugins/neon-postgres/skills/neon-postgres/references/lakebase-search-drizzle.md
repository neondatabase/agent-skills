# Managing Lakebase Search with Drizzle

When the user wants Lakebase Search managed through Drizzle, treat the SQL in [Vector Search](vector-search.md), [Full-Text Search](full-text-search.md), and [Hybrid Search](hybrid-search.md) as the source of truth and apply it as below. Use Drizzle for all schema and migration management unless the user says otherwise. Requires `drizzle-orm` 0.31+ and `drizzle-kit` 0.22+ for the `vector` column type and the `cosineDistance` helper.

Contents:

- [Schema](#schema) — columns Drizzle can express
- [Custom Migration](#custom-migration) — extension, generated `tsvector` column, and custom-method indexes
- [Query](#query) — vector, BM25, and hybrid reads
- [Tune Per Query](#tune-per-query) — per-query GUCs

Rules:

- Split the schema at Drizzle's boundary: columns Drizzle can express go in `schema.ts`, everything else goes in a custom migration.
- Use `drizzle-kit generate` then `migrate`. Never run `drizzle-kit push`.
- Run every migration over the direct (unpooled) connection.

Drizzle cannot express `CREATE EXTENSION`, the `lakebase_ann` / `lakebase_bm25` access methods, or a generated `tsvector` column, which is why those go in a custom migration.

`push` drops the extension objects, the generated `tsvector` column, and the custom-method indexes, because none of them appear in the schema. Run `drizzle-kit generate` then `migrate` over the **direct (unpooled)** connection, as [Migrations](../SKILL.md) requires.

## Schema


```typescript
// src/schema.ts
import { pgTable, bigint, text, vector } from "drizzle-orm/pg-core";

export const documents = pgTable("documents", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
});
```

Set the dimension to match your embedding model. Do not add `body_tsv` to the schema: Postgres maintains it and the app never writes it, so define it in the custom migration below.

## Custom Migration

Generate an empty migration and write the SQL Drizzle cannot express:

```bash
npx drizzle-kit generate --custom --name=lakebase_search
```

```sql
-- drizzle/NNNN_lakebase_search.sql
CREATE EXTENSION IF NOT EXISTS lakebase_vector CASCADE;
CREATE EXTENSION IF NOT EXISTS lakebase_text;

ALTER TABLE documents
  ADD COLUMN body_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', body)) STORED;

CREATE INDEX documents_embedding_ann ON documents
  USING lakebase_ann (embedding vector_cosine_ops);
```

Create the `lakebase_bm25` index only after the initial corpus is loaded, so its build-time statistics are meaningful (see [Full-text search](full-text-search.md)). Put it in a **separate later migration** that runs after seeding, or in a data-load step:

```sql
-- drizzle/NNNN_bm25_index.sql, applied after the corpus is seeded
CREATE INDEX documents_body_bm25 ON documents USING lakebase_bm25 (body_tsv);
```

## Query

Use the query builder with Drizzle's `cosineDistance` helper for vector search. It emits the `<=>` operator, so keep the index on `vector_cosine_ops`:

```typescript
import { cosineDistance } from "drizzle-orm";
import { documents } from "./schema";

// queryEmbedding: number[] from the same model used for stored documents
const distance = cosineDistance(documents.embedding, queryEmbedding);

const rows = await db
  .select({ id: documents.id, title: documents.title, distance })
  .from(documents)
  .orderBy(distance)
  .limit(k);
```

BM25 has no Drizzle helper: `<@>` and `to_bm25query` require raw SQL. `body_tsv` is not in the schema, so reference it by name. Bind user input as parameters through the `sql` template:

```typescript
import { sql } from "drizzle-orm";

const rows = await db.execute(sql`
  SELECT id, title,
    body_tsv <@> to_bm25query(
      to_tsvector('english', ${queryText}),
      'documents_body_bm25'::regclass
    ) AS score
  FROM documents
  ORDER BY score
  LIMIT ${k}
`);
```

Run the [hybrid search](hybrid-search.md) RRF query the same way: raw SQL through `db.execute`.

## Tune Per Query

Per-query GUCs (`lakebase_ann.probes`, `lakebase_ann.epsilon`, `lakebase_bm25.default_limit`, `lakebase_bm25.prefilter`) must be set with `SET LOCAL` inside a transaction so they apply to the same pooled connection as the query:

```typescript
import { cosineDistance, sql } from "drizzle-orm";
import { documents } from "./schema";

const distance = cosineDistance(documents.embedding, queryEmbedding);

const rows = await db.transaction(async (tx) => {
  // SET LOCAL scopes the GUC to this transaction's connection; do not hoist it out
  await tx.execute(sql`SET LOCAL lakebase_ann.probes = 10`); // example value; tune per vector-search.md
  return tx
    .select({ id: documents.id, title: documents.title, distance })
    .from(documents)
    .orderBy(distance)
    .limit(k);
});
```

Sources:

- [Get started with Lakebase Search](https://neon.com/docs/ai/lakebase-search-get-started)
- [Schema migration with Lakebase Postgres and Drizzle ORM](https://neon.com/docs/guides/drizzle-migrations)