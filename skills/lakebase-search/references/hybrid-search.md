# Hybrid Search

Use hybrid search when either semantic similarity or exact vocabulary can identify a relevant document. Lakebase
Search does not provide a built-in hybrid function: run vector and BM25 retrieval separately, then combine their
results with a fusion strategy suited to the workload.

Reciprocal Rank Fusion (RRF) is the approach in the Lakebase Search get-started guide and a useful default because it
combines ranks instead of incomparable raw distances and scores. It is not the only option: weighted rank fusion,
normalized score fusion, or a reranker may fit applications with different relevance signals.

## RRF Example

For rank `r` and constant `k`, each retriever contributes `1 / (k + r)`. The documented starting point uses 40
candidates per retriever and `k = 60`; tune both for the corpus and workload.

Bind the query embedding as `$1`, query text as `$2`, and final result count as `$3`:

```sql
WITH vector_ranked AS (
  SELECT id, RANK() OVER (ORDER BY distance) AS rank
  FROM (
    SELECT id, embedding <=> $1::vector AS distance
    FROM documents
    ORDER BY distance
    FETCH FIRST 40 ROWS WITH TIES
  ) AS vector_candidates
),
keyword_ranked AS (
  SELECT id, RANK() OVER (ORDER BY score) AS rank
  FROM (
    SELECT
      id,
      body_tsv <@> to_bm25query(
        to_tsvector('english', $2),
        'documents_body_bm25'::regclass
      ) AS score
    FROM documents
    ORDER BY score
    FETCH FIRST 40 ROWS WITH TIES
  ) AS keyword_candidates
)
SELECT
  d.id,
  d.title,
  COALESCE(1.0 / (60 + v.rank), 0) +
    COALESCE(1.0 / (60 + k.rank), 0) AS rrf_score
FROM documents AS d
LEFT JOIN vector_ranked AS v ON v.id = d.id
LEFT JOIN keyword_ranked AS k ON k.id = d.id
WHERE v.id IS NOT NULL OR k.id IS NOT NULL
ORDER BY rrf_score DESC, d.id
LIMIT $3;
```

`RANK()` gives tied retrieval scores the same rank. Sort by `rrf_score` descending and use the stable ID as a final
tie-breaker.

`FETCH FIRST ... ROWS WITH TIES` keeps every candidate tied at the cutoff, so `RANK()` receives the complete
boundary tie group. The candidate set can therefore exceed 40 rows. `lakebase_bm25.default_limit` defaults to
`1000`; increase it only when the BM25 candidate set needs to exceed that value.

## Adapt the Hybrid Search

- Retrieve more candidates from each source than the final result count; otherwise one retriever can dominate before
  fusion has enough overlap. Keep `lakebase_bm25.default_limit` above the BM25 candidate target and allow room for
  boundary ties.
- Keep each retriever's operator and index configuration correct independently before tuning RRF.
- Tune candidate counts and the RRF constant with judged or behavioral relevance data, plus latency measurements.
- Add weights only when product evidence shows one retriever should contribute more. Weight the reciprocal-rank
  contributions, not the raw vector distance and negative BM25 score.
- Apply the same access-control and tenant filters to both candidate CTEs. If BM25 filters are strict and cheap,
  evaluate whether `lakebase_bm25.prefilter` improves the filtered query.

Source: [Lakebase Search get-started guide][lakebase-search-guide].

[lakebase-search-guide]: https://neon.com/docs/ai/lakebase-search-get-started#combine-results-with-hybrid-search
