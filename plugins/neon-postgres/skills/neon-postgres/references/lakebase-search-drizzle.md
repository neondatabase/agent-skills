# Managing Lakebase Search with Drizzle

When the user wants Lakebase Search managed through Drizzle, treat the SQL in [Vector Search](vector-search.md), [Full-Text Search](full-text-search.md), and [Hybrid Search](hybrid-search.md) as the source of truth and apply it as below. Use Drizzle for all schema and migration management unless the user says otherwise.

Requires `drizzle-orm` 0.36+ and `drizzle-kit` 0.27+: the schema below returns its indexes as an array from the `pgTable` extra-config callback. Those versions also include generated-column support for the `tsvector` column, the custom-method `.using(...).op(...)` index API for `lakebase_ann`, the `vector` column type, and the `cosineDistance` helper.

Contents:

- [Config](#config): `drizzle.config.ts` and the migration connection
- [Extensions](#extensions): custom migration required to create extensions (Drizzle can't)
- [Schema](#schema): columns, generated `tsvector`, and the ANN index
- [BM25 Index](#bm25-index): created after the corpus is seeded
- [Generate and Store Embeddings](#generate-and-store-embeddings): call the AI Gateway and insert vectors with Drizzle
- [Query](#query): vector, BM25, and hybrid reads
- [Tune Per Query](#tune-per-query): per-query GUCs

Rules:

- Express everything Drizzle can in `schema.ts`: the columns, the generated `tsvector`, and the `lakebase_ann` index. Only `CREATE EXTENSION` and the post-seed `lakebase_bm25` index need custom migrations.
- Use `drizzle-kit generate` then `migrate`. Never run `drizzle-kit push` (it reconciles the database to `schema.ts`, so it drops the post-seed `lakebase_bm25` index and any other object not declared there)
- Run every migration over the direct (unpooled) connection.
- The extension must exist before the `vector` column and the `lakebase_ann` index that depend on it.

## Config

`drizzle-kit generate` and `migrate` read `drizzle.config.ts`. If the connection string is in `.env`, install `dotenv` (`npm install dotenv`) and load it here. Point `dbCredentials.url` at the **direct (unpooled)** connection string:

```typescript
// drizzle.config.ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED;
if (!databaseUrl) throw new Error("Missing DATABASE_URL_UNPOOLED");

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Direct (unpooled) URL. Neon exposes it as DATABASE_URL_UNPOOLED.
  dbCredentials: { url: databaseUrl },
});
```

## Extensions

Drizzle cannot express `CREATE EXTENSION`, and the `vector` column and `lakebase_ann` index below depend on `lakebase_vector`, so generate a custom migration for the extensions **first** so it runs before the schema migration:

```bash
npx drizzle-kit generate --custom --name=lakebase_extensions
```

```sql
-- drizzle/0000_lakebase_extensions.sql
CREATE EXTENSION IF NOT EXISTS lakebase_vector CASCADE;
CREATE EXTENSION IF NOT EXISTS lakebase_text;
```

## Schema

The columns, the generated `tsvector`, and the `lakebase_ann` index all go in `schema.ts`. `tsvector` has no built-in Drizzle type, so define it using the `customType`:

```typescript
// src/schema.ts
import { pgTable, bigint, text, vector, index, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const documents = pgTable(
  "documents",
  {
    id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }),
    bodyTsv: tsvector("body_tsv").generatedAlwaysAs(
      sql`to_tsvector('english', "body")`,
    ),
  },
  (table) => [
    index("documents_embedding_ann").using(
      "lakebase_ann",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);
```

The 1024-dimensional column is an example; set it to the output dimension of your selected embedding model. Use the same model and dimensions for stored documents and queries. Postgres maintains `body_tsv`, so never write it from the app. Generate and apply the migration after the extensions migration above:

```bash
npx drizzle-kit generate --name=lakebase_search
npx drizzle-kit migrate
```

## BM25 Index

Keep the `lakebase_bm25` index out of `schema.ts`. It must be built only after the initial corpus is loaded, so its build-time statistics are meaningful (see [Full-text search](full-text-search.md)) — a schema migration would build it against an empty table. Add it in a later custom migration that runs after seeding:

```bash
npx drizzle-kit generate --custom --name=bm25_index
```

```sql
-- drizzle/NNNN_bm25_index.sql, applied after the corpus is seeded
CREATE INDEX documents_body_bm25 ON documents USING lakebase_bm25 (body_tsv);
```

## Generate and Store Embeddings

Your application sends an HTTP request to the AI Gateway through the OpenAI SDK to generate embeddings; Drizzle stores and queries the resulting vectors. Follow the [Vector search setup](vector-search.md#prepare-embeddings) to enable the gateway and pull its token and bare-host base URL into `.env`. For a standalone TypeScript app, install `openai` and `dotenv` (`npm install openai dotenv`), then configure the OpenAI client and an application helper:

```typescript
import "dotenv/config";
import OpenAI from "openai";

const apiKey = process.env.NEON_AI_GATEWAY_TOKEN;
const gatewayBaseUrl = process.env.NEON_AI_GATEWAY_BASE_URL;
if (!apiKey || !gatewayBaseUrl) {
  throw new Error("Missing Neon AI Gateway credentials");
}

const aiGateway = new OpenAI({
  apiKey,
  baseURL: `${gatewayBaseUrl}/v1`,
});
const embeddingModel = "qwen3-embedding-0-6b"; // example; see the AI Gateway embeddings docs for model IDs

async function generateEmbeddings(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const response = await aiGateway.embeddings.create({
    model: embeddingModel,
    input: inputs,
    encoding_format: "float",
  });
  const vectors: number[][] = [];
  for (const item of response.data) vectors[item.index] = item.embedding;
  return inputs.map((_, index) => {
    const embedding = vectors[index];
    if (!embedding) throw new Error(`Missing embedding for input ${index}`);
    return embedding;
  });
}
```

Generate a document vector, then insert it with Drizzle:

```typescript
const [embedding] = await generateEmbeddings([body]);
if (!embedding) throw new Error("Missing document embedding");
await db.insert(documents).values({
  title,
  body,
  embedding,
});
```

For bulk ingestion, send multiple documents in one gateway request, then insert their vectors in the corresponding rows:

```typescript
const vectors = await generateEmbeddings(rows.map((row) => row.body));
await db.insert(documents).values(
  rows.map((row, index) => {
    const embedding = vectors[index];
    if (!embedding) throw new Error(`Missing embedding for row ${index}`);
    return { ...row, embedding };
  }),
);
```

Chunk large imports within gateway input and rate limits and database write limits. The same `generateEmbeddings()` helper handles document and query text; format each input according to the selected model's conventions. Use the same model and dimensions for both. Re-embed the corpus when changing models; a matching vector dimension alone does not make embeddings from different models comparable.

## Query

Use the query builder with Drizzle's `cosineDistance` helper for vector search. It emits the `<=>` operator, so keep the index on `vector_cosine_ops`:

```typescript
import { cosineDistance } from "drizzle-orm";
import { documents } from "./schema";

const [queryEmbedding] = await generateEmbeddings([queryText]);
if (!queryEmbedding) throw new Error("Missing query embedding");
const distance = cosineDistance(documents.embedding, queryEmbedding);

const rows = await db
  .select({ id: documents.id, title: documents.title, distance })
  .from(documents)
  .orderBy(distance)
  .limit(k);
```

BM25 has no Drizzle helper: `<@>` and `to_bm25query` require raw SQL. Reference the generated column by its `body_tsv` name. Bind user input as parameters through the `sql` template:

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
  // SET LOCAL scopes the GUC to this transaction's connection; do not hoist it out.
  // Keep probes at 'auto' unless an IVF `lists` layout exists: a numeric value must
  // match the `lists` shape or it errors ("need 0 probes ..."). See vector-search.md.
  await tx.execute(sql`SET LOCAL lakebase_ann.probes = 'auto'`);
  return tx
    .select({ id: documents.id, title: documents.title, distance })
    .from(documents)
    .orderBy(distance)
    .limit(k);
});
```

Sources:

- [AI Gateway embeddings](https://neon.com/docs/ai-gateway/embeddings)
- [Get started with Lakebase Search](https://neon.com/docs/ai/lakebase-search-get-started)
- [Schema migration with Lakebase Postgres and Drizzle ORM](https://neon.com/docs/guides/drizzle-migrations)
