# Semantic Vector Search

Use `lakebase_vector` for approximate nearest-neighbor retrieval over embeddings. It retains pgvector's vector types,
distance operators, and query syntax; the index access method is `lakebase_ann`.

## Build the Index

Choose the operator class and query operator as a matched pair:

| Metric | Common use | Operator class | Distance operator |
| --- | --- | --- | --- |
| Cosine | Most text embeddings | `vector_cosine_ops` | `<=>` |
| L2 / Euclidean | Absolute distance matters; vectors do not need normalization | `vector_l2_ops` | `<->` |
| Inner product | Similar to cosine but normalized | `vector_ip_ops` | `<#>` |

```sql
CREATE INDEX documents_embedding_ann ON documents
  USING lakebase_ann (embedding vector_cosine_ops);
```

For a large, frequently changing table, use `CREATE INDEX CONCURRENTLY` or `REINDEX INDEX CONCURRENTLY` when avoiding
blocked reads and writes matters.

## Query

Generate the query embedding with the same model and preprocessing used for stored documents, then bind it as a
parameter:

```sql
SELECT id, title, embedding <=> $1::vector AS distance
FROM documents
ORDER BY distance
LIMIT $2;
```

Distance sorts ascending: a smaller value is a closer match. Keep the query operator consistent with the index
operator class.

To filter by a similarity radius, use the matching boolean range operator in `WHERE` and the distance operator in
`ORDER BY`:

```sql
SELECT id, title
FROM documents
WHERE embedding <<=>> sphere($1::vector, 0.5)
ORDER BY embedding <=> $1::vector
LIMIT $2;
```

The cosine range operator `<<=>>` returns a boolean; do not use it as the ranking expression.

## Tune Search

Inspect the index before overriding defaults:

```sql
SELECT lakebase_ann_index_info('documents_embedding_ann');
```

This reports `lists`, `default_probes`, and `default_epsilon`. Small datasets use exact flat search before IVF lists
are built. In that state, `lists` and `default_probes` are empty, probes cannot be set, and epsilon has no effect;
this is expected.

For an IVF index, `lakebase_ann.probes` controls how many partitions are searched. Higher values generally improve
recall at the cost of speed. `lakebase_ann.epsilon` controls the reranking margin; its default is `1.9` and valid
range is `0.0` through `4.0`.

```sql
BEGIN;
SET LOCAL lakebase_ann.probes = '10';
SET LOCAL lakebase_ann.epsilon = '1.9';

SELECT id, title
FROM documents
ORDER BY embedding <=> $1::vector
LIMIT $2;
COMMIT;
```

Benchmark probe values against representative query embeddings and choose the smallest value that satisfies both
recall and tail-latency targets. Keep the settings and query in the same transaction when using a connection pool or
stateless driver.

Source: [`lakebase_vector` documentation](https://neon.com/docs/extensions/lakebase-vector).
