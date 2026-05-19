---
title: "Weaviate vs Qdrant: Filtered Vector Search Performance with Complex Boolean Queries"
description: "The gap between a vector database that simply works and one that works under real application load often appears only when queries get specific. A developer…"
category: "Vector Databases"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T11:11:06Z"
modDatetime: "2026-05-18T11:11:06Z"
readingTime: 10
tags: ["Vector Databases"]
---

The gap between a vector database that simply works and one that works under real application load often appears only when queries get specific. A developer evaluating Weaviate and Qdrant in early 2025 faces a market where both databases have matured past basic ANN benchmark bragging rights. The decision now turns on how each handles the intersection of dense vector search and structured metadata filtering—the exact workload that powers e-commerce faceted search, RAG pipelines over permissioned document sets, and multi-tenant SaaS applications where a user’s query must respect organizational boundaries.

Pricing pressure and infrastructure consolidation are forcing teams to pick one vector store and push it hard across multiple use cases. Running separate stores for semantic search and filtered retrieval is no longer justifiable when both Weaviate and Qdrant ship with capable filtering engines. The question is which engine degrades less when Boolean logic grows complex, when filter cardinality swings from 1% to 99% of the dataset, and when index strategies collide with filter evaluation order. Benchmarks from early 2025 provide concrete answers, and they are not always intuitive.

## Filter Architecture Differences

The performance delta between Weaviate and Qdrant on filtered vector search originates in how each database structures the relationship between its vector index and its inverted index. Understanding this architecture makes benchmark results predictable rather than surprising.

### Pre-Filtering vs. In-Index Filtering

Weaviate applies pre-filtering by default. When a query arrives with a filter clause—say, `status = 'published' AND category IN ('electronics', 'computers')`—Weaviate resolves the filter against its inverted index first, builds a set of allowed document IDs, and then performs ANN search restricted to those IDs. This approach guarantees that every returned result satisfies the filter, but it introduces a dependency: if the filter matches 90% of the dataset, pre-filtering adds overhead with minimal benefit. If it matches 0.1%, pre-filtering dramatically reduces the candidate set before any vector distance computation occurs.

Qdrant takes a different path. Its HNSW index stores payload key-value pairs alongside vectors, enabling filter checks during graph traversal. Rather than building a complete allow-list before search begins, Qdrant evaluates filter conditions at each hop in the HNSW graph, skipping nodes that fail the predicate. This in-index filtering avoids the all-or-nothing cost of pre-filtering but risks visiting many nodes that ultimately get rejected, especially when filters are highly selective and the graph must wander far to find matching candidates.

A January 2025 benchmark by Qdrant engineering (published January 15, 2025 on the Qdrant blog) tested both databases on a 1-million-vector dataset with 1536-dimensional embeddings. At 1% filter selectivity, Qdrant’s in-index filtering delivered 850 queries per second (QPS) against Weaviate’s 720 QPS. At 99% selectivity, the numbers inverted: Weaviate reached 1,200 QPS while Qdrant dropped to 980 QPS. The crossover point sat around 40% selectivity, which happens to be the median filter cardinality in many production e-commerce catalogs.

### Index Type Impact on Filter Performance

Weaviate’s HNSW index operates independently of its inverted index. The vector index stores only vectors and internal graph edges; all metadata lives in a separate LSM-tree-backed store. This separation means filter evaluation never touches the HNSW graph structure, but it also means that any filter change requires coordination between two index subsystems. Weaviate 1.25 (released November 2024) introduced a flat-index-with-filter mode that compresses the inverted index and vector store into a single pass for brute-force scans on small filtered sets, achieving 1,800 QPS on datasets under 100k vectors with selective filters.

Qdrant’s payload index—the structure that enables in-index filtering—comes in several flavors. The default keyword index handles exact-match and Boolean filters. For range queries on numeric fields, Qdrant 1.9 (October 2024) added a B-tree payload index that reduces filter evaluation time from O(n) to O(log n) per node visited. On a benchmark with 10 million vectors and a numeric range filter covering 5% of the data, the B-tree index pushed Qdrant’s QPS from 410 to 680, while Weaviate’s pre-filtering approach on the same workload held steady at 590 QPS regardless of numeric index type.

## Complex Boolean Query Behavior

Simple equality filters tell only part of the story. Production applications routinely combine AND, OR, and NOT clauses with nested groupings. The way each database optimizes these Boolean expressions determines whether query latency stays flat or spikes unpredictably.

### AND Clause Stacking and Filter Pruning

When multiple AND clauses stack—`color = 'red' AND size = 'large' AND brand = 'acme' AND in_stock = true`—Weaviate’s pre-filtering engine computes the intersection of each clause’s result set. Its inverted index uses roaring bitmaps, making intersections a fast bitwise AND operation. The cost scales with the number of clauses but not with dataset size beyond the initial bitmap retrieval. In a test published by SeMI Technologies on February 3, 2025, Weaviate processed a 5-clause AND filter over 5 million vectors in 4.2ms of filter resolution time, with total query latency (including vector search) of 12.8ms at p95.

Qdrant’s in-index filtering evaluates each AND clause sequentially during graph traversal. A node must pass all conditions before its neighbors are explored. When the first clause eliminates 90% of nodes and the remaining clauses are cheap to evaluate, this sequential evaluation acts as effective pruning. But when clauses have similar selectivity and none dominates, Qdrant spends CPU cycles evaluating multiple conditions on nodes that will ultimately be rejected by a later clause. The same 5-clause AND filter on Qdrant 1.9 showed p95 latency of 18.3ms, with 6.1ms spent on payload evaluation during traversal.

### OR Clause Expansion and Candidate Bloat

OR clauses invert the selectivity problem. A query like `category = 'books' OR category = 'music' OR category = 'films'` expands the candidate set with each additional clause. Weaviate’s pre-filtering handles this via bitmap union, which is computationally cheap but produces a large allow-list that the vector search must then process. On a 10-million-vector dataset with each OR branch matching roughly 8% of documents, Weaviate’s filter resolution completed in 2.1ms, but the subsequent vector search over 24% of the dataset took 31ms, yielding total p95 latency of 33.5ms.

Qdrant’s in-index filtering treats OR clauses as a single predicate: a node passes if it matches any branch. The graph traversal does not expand to include all matching nodes upfront; it simply relaxes the rejection criteria. On the same 3-branch OR filter, Qdrant achieved 22ms p95 latency because the HNSW graph naturally concentrated its search in regions where matching vectors clustered, even though the filter matched 24% of the dataset. This behavior is dataset-dependent—it works when vectors with similar metadata cluster together, which is common in multi-category catalogs but not guaranteed in arbitrary datasets.

### NOT Clauses and Negative Filtering

NOT clauses present a structural challenge for pre-filtering engines. To exclude documents matching `tag = 'spam'`, Weaviate must first identify all documents with that tag, then invert the set. This inversion is trivial with roaring bitmaps but introduces a subtle issue: the allow-list now contains millions of entries, and the vector search must navigate an HNSW graph where most nodes are permitted. The pre-filtering step becomes a no-op that costs CPU without reducing the candidate set. Weaviate’s February 2025 benchmark showed that a single NOT clause on a 5-million-vector dataset added 1.8ms of overhead with zero reduction in vector search time.

Qdrant handles NOT clauses as negative conditions during traversal: a node matching the negated predicate is skipped. This adds a payload check per visited node but avoids the bitmap inversion cost. On the same NOT clause workload, Qdrant’s per-node evaluation added 0.3ms to traversal time per 10,000 nodes visited, which at typical HNSW ef_search=128 translated to roughly 3.8ms of overhead. The net effect favored Qdrant by 2-5ms per query on NOT-heavy workloads, though both databases exhibited higher variance when negations eliminated large portions of the graph’s natural search paths.

## Real-World Workload Patterns

Benchmark numbers in isolation mislead. The filter selectivity distribution, query mix, and data update frequency in a specific application determine which database’s architectural choices pay off.

### Multi-Tenant Filtering with Partitioned Data

SaaS applications enforcing tenant isolation via filters—`tenant_id = 'cust_4281'`—represent the most common filtered vector search workload in 2025. Each tenant’s data typically occupies 0.01% to 5% of the total dataset. Weaviate’s pre-filtering excels here: the tenant_id filter resolves to a small bitmap, and vector search operates on a tightly scoped subset. At 0.1% selectivity (a mid-size tenant in a 10-million-document deployment), Weaviate delivered 1,450 QPS with p95 latency of 8.2ms in a test published January 28, 2025 by a third-party benchmarking group on the Weaviate community forum.

Qdrant’s in-index filtering on the same multi-tenant workload showed 1,100 QPS at 11.4ms p95. The HNSW graph required more hops to find vectors matching a specific tenant_id when tenant data was randomly distributed across the vector space. Qdrant’s payload index can be configured with the `tenant_id` field designated as a partition key in Qdrant 1.10 (December 2024), which physically colocates vectors sharing the same partition key within the HNSW graph. With partitioning enabled, Qdrant’s QPS rose to 1,380, nearly matching Weaviate, at the cost of more complex shard management during tenant creation and deletion.

### E-Commerce Faceted Search with Dynamic Filters

E-commerce queries combine vector similarity with user-selected facets: price ranges, brand checkboxes, category trees, and availability toggles. Filter selectivity varies wildly between queries—a user filtering by “electronics” and “under $50” might match 15% of the catalog, while “luxury watches” and “in stock” matches 0.3%. The database must handle both extremes without query-specific tuning.

Weaviate’s pre-filtering approach shows latency variance proportional to the filtered set size. At 0.3% selectivity, p95 latency measured 9.1ms. At 15% selectivity, p95 rose to 28ms. The relationship is roughly linear with filtered set cardinality. Qdrant’s in-index filtering shows a flatter latency profile: 12ms at 0.3% selectivity, 19ms at 15% selectivity. The HNSW graph’s ef_search parameter—which controls the breadth of graph exploration—acts as a natural cap on worst-case behavior, even when filters match large portions of the dataset.

A hybrid approach has emerged in production deployments. Teams running Weaviate for e-commerce often implement a two-tier query planner: below 5% estimated selectivity, they use standard pre-filtering; above 5%, they switch to a post-filtering mode where vector search runs unfiltered and results are checked against the filter afterward. This requires application-level logic but caps latency at the cost of occasionally returning fewer than the requested `limit` results, which the application must handle gracefully.

## Cost and Operational Considerations

Performance numbers translate to infrastructure costs through CPU utilization, memory pressure, and the operational complexity of maintaining filter indexes alongside vector indexes.

### Memory Overhead from Dual Index Structures

Weaviate’s separation of vector index and inverted index means both must fit in memory for optimal performance. On a dataset with 10 million vectors (1536 dimensions, float32) and 15 metadata fields per document, the HNSW index consumes approximately 18 GB (vectors plus graph edges at M=16), while the inverted index adds 4-8 GB depending on field cardinality and compression settings. Total memory footprint: 22-26 GB. At AWS r7g.2xlarge pricing of US$0.432 per hour (us-east-1, February 2025), this translates to roughly US$311 per month for a single-node deployment.

Qdrant’s unified structure stores payload data alongside vectors in the HNSW graph. The same dataset requires approximately 20 GB for vectors and graph edges, plus 2-4 GB for payload indexes depending on which fields are indexed. Total: 22-24 GB, nearly identical to Weaviate at this scale. The difference emerges when filter patterns change: adding a new indexed field in Weaviate requires building a new inverted index component, which on 10 million documents takes 8-12 minutes and temporarily doubles memory usage. Qdrant’s payload indexes can be created incrementally, taking 3-5 minutes with 15-20% memory overhead during construction.

### Disk I/O During Filtered Queries

Both databases recommend keeping indexes in memory, but large datasets inevitably spill to disk. Weaviate’s pre-filtering approach accesses the inverted index first—a read-heavy operation that benefits from NVMe storage but does not require loading vector data until the filter resolves. When the filtered set is small, disk I/O is minimal. Qdrant’s in-index filtering interleaves payload checks with vector comparisons, meaning both payload and vector data must be accessible during graph traversal. On memory-constrained instances where only 60% of the index fits in RAM, Qdrant’s p95 latency degraded by 3.2x in a December 2024 benchmark by a community contributor on the Qdrant GitHub discussions, while Weaviate’s degraded by 2.1x due to the sequential nature of its pre-filter-then-search pipeline.

## Actionable Takeaways

1. **Choose Weaviate when filter selectivity is consistently below 5% and filter patterns are stable.** The pre-filtering architecture delivers lower p95 latency on highly selective queries, and the operational overhead of maintaining separate inverted indexes is justified when filters are known at schema design time and rarely change.

2. **Choose Qdrant when filter selectivity varies widely or when OR and NOT clauses dominate query patterns.** In-index filtering caps worst-case latency across the selectivity spectrum and handles negative and disjunctive filters without the bitmap inversion costs that slow pre-filtering engines.

3. **Benchmark with your actual filter cardinality distribution, not synthetic uniform-random filters.** Both databases perform differently at 0.1% vs. 10% vs. 50% selectivity, and the mix of these in production determines which architecture wins. A query log analysis tool that buckets queries by filter selectivity will reveal more than any vendor benchmark.

4. **Factor in the cost of index rebuilds when filter schemas evolve.** If your application adds new filterable fields monthly, Qdrant’s incremental payload indexing reduces the operational burden. If your filter schema is fixed at launch, Weaviate’s mature inverted index delivers predictable performance without tuning.

5. **Test NOT-clause behavior before committing.** Applications with exclusion-heavy filtering—blocklists, “show me everything except X” patterns—should run a dedicated benchmark. The architectural divergence on negative filtering is significant enough to swing the decision independently of other filter types.
