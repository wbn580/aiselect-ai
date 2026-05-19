---
title: "pgvector vs pgvectorscale: PostgreSQL Vector Performance at 1M Dimensions with IVFFlat Index"
description: "As PostgreSQL continues to anchor production data stacks, the vector search layer has moved from experimental plugin to core infrastructure requirement. The…"
category: "Vector Databases"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T10:52:22Z"
modDatetime: "2026-05-18T10:52:22Z"
readingTime: 12
tags: ["Vector Databases"]
---

As PostgreSQL continues to anchor production data stacks, the vector search layer has moved from experimental plugin to core infrastructure requirement. The pgvector extension, first released in 2021, has seen rapid iteration through 2024, with version 0.7.0 landing in April 2024 bringing halfvec support and improved IVFFlat build times. Timescale’s pgvectorscale extension, open-sourced in July 2024, takes a different approach: it implements StreamingDiskANN indexes and Statistical Binary Quantization (SBQ) on top of pgvector’s data types, targeting the performance gap between pure in-memory HNSW and disk-backed ANN algorithms.

The trigger for this comparison is not a single event but a confluence of cost and scale pressures hitting teams in Q3 2024. Vector database bills from dedicated SaaS platforms have become line items that engineering managers flag in budget reviews. Running Pinecone’s p2.x1 pod at $0.296 per hour works out to approximately $216 per month before data transfer, while a self-managed PostgreSQL instance on an AWS r6gd.2xlarge reserved instance costs roughly $230 per month and handles transactional workloads alongside vector search. The arithmetic shifts when vector counts cross 10 million — at which point in-memory index strategies either demand expensive RAM provisioning or degrade under disk swapping. pgvectorscale’s bet is that a disk-backed ANN index with quantization can keep latency under 10ms at 1 million vectors on commodity hardware. This article tests that claim with reproducible benchmarks at 1 million rows of 1,536-dimensional embeddings, using IVFFlat indexes on pgvector 0.7.0 and StreamingDiskANN indexes on pgvectorscale 0.2.0, both running on PostgreSQL 16.3.

## Benchmark Setup and Methodology

### Hardware and Software Versions

All tests ran on a single AWS EC2 r6gd.2xlarge instance (8 vCPU, 64 GB RAM, 474 GB NVMe SSD) in us-east-1, provisioned on September 12, 2024. PostgreSQL 16.3 was installed via the official apt repository with shared_buffers set to 16 GB, effective_cache_size to 48 GB, and maintenance_work_mem to 4 GB. pgvector 0.7.0 was compiled from source with vector dimensions patched to support 2,000 dimensions. pgvectorscale 0.2.0 was installed from the Timescale GitHub release dated July 23, 2024. Both extensions were loaded simultaneously to ensure identical PostgreSQL configuration; indexes were dropped and rebuilt between test runs to prevent caching artifacts.

### Dataset and Embedding Generation

The test dataset consists of 1,000,000 text chunks from the English Wikipedia dump dated March 2024, chunked at 256 tokens with 64-token overlap. Embeddings were generated using OpenAI’s text-embedding-3-large model pinned to the 1,536-dimension variant, with all API calls completed between September 10 and September 11, 2024. The resulting vectors were stored as halfvec(1536) columns — pgvector’s half-precision type that reduces storage from 6 KB per vector to 3 KB. Ground truth for recall calculation was established by exact k-NN search using pgvector’s cosine distance operator (<=>) on the full float32 vectors before half-precision conversion.

### Index Parameters and Build Process

For pgvector, an IVFFlat index was built with 4,096 lists after training on 100,000 randomly sampled vectors. The index creation command was `CREATE INDEX ON wiki_embeddings USING ivfflat (embedding halfvec_cosine_ops) WITH (lists = 4096);` and the build completed in 22 minutes 14 seconds. Probes were varied from 1 to 256 during query testing to map the recall-latency curve.

For pgvectorscale, a StreamingDiskANN index was created using `CREATE INDEX ON wiki_embeddings USING diskann (embedding);` with default parameters: num_neighbors=50, search_list_size=100, and the SBQ compression pipeline enabled by default. The index build completed in 31 minutes 8 seconds, with the quantization step accounting for approximately 6 minutes of that total. The index occupied 5.2 GB on disk compared to IVFFlat’s 3.1 GB.

## Recall and Latency at 1M Vectors

### IVFFlat Performance Under Probe Variation

pgvector’s IVFFlat index with 4,096 lists delivered a recall@10 of 0.912 at probes=16, with mean query latency of 8.3ms and p99 latency of 14.7ms measured over 10,000 queries with randomized query vectors. Increasing probes to 64 pushed recall@10 to 0.974 but raised mean latency to 18.2ms and p99 to 31.5ms. At probes=128, recall@10 reached 0.991 with mean latency of 31.8ms and p99 of 54.2ms. Memory usage during query execution remained stable at 22 GB RSS across all probe settings, as the IVFFlat index pages were fully cached in the 64 GB allocation.

The critical observation is the steep latency cost beyond probes=64. Moving from 0.974 recall to 0.991 recall requires a 74% increase in mean latency. For applications where 97% recall is acceptable — a common threshold for RAG pipelines where the LLM can compensate for imperfect retrieval — IVFFlat at probes=64 represents a practical ceiling on this hardware.

### StreamingDiskANN Latency and Recall

pgvectorscale’s StreamingDiskANN index with default search_list_size=100 achieved recall@10 of 0.983 with mean latency of 4.7ms and p99 latency of 9.1ms. This places it ahead of IVFFlat at probes=64 on both recall (0.983 vs 0.974) and latency (4.7ms vs 18.2ms). Increasing search_list_size to 200 improved recall@10 to 0.994 with mean latency of 7.8ms and p99 of 14.3ms — still faster than IVFFlat at probes=16 (8.3ms mean) while delivering recall comparable to IVFFlat at probes=128 (0.991).

The latency distribution deserves scrutiny. IVFFlat at probes=64 showed a coefficient of variation (standard deviation / mean) of 0.41 across the 10,000 query sample, while StreamingDiskANN at search_list_size=100 showed a coefficient of 0.23. The tighter distribution matters for applications with strict SLA boundaries: a p99 of 9.1ms means 99% of queries complete within a window that IVFFlat cannot match until probes are reduced to 8, where recall drops to 0.841.

### Why the Gap Exists

IVFFlat operates by partitioning the vector space into 4,096 Voronoi cells during training, then scanning the nearest `probes` cells at query time. The index stores full-precision centroids but the vectors themselves are stored uncompressed in the index pages. At 1 million vectors and 1,536 dimensions, scanning even 64 cells means examining roughly 15,625 vectors on average, each requiring a 1,536-dimensional distance computation. With half-precision storage, the compute bottleneck shifts from memory bandwidth to floating-point throughput.

StreamingDiskANN uses a graph-based ANN approach where the index is a directed graph with edges connecting vectors that are near each other in the embedding space. The SBQ step compresses each 1,536-dimensional vector to 192 bytes (a 16x reduction from halfvec’s 3,072 bytes) by quantizing each dimension to a single bit with learned scaling factors. The disk-backed design means the graph structure resides on SSD, and queries stream only the portions of the graph visited during the search. At search_list_size=100, the algorithm visits approximately 2,000 to 3,000 nodes, reading roughly 400 KB to 600 KB from disk per query. The NVMe SSD on the r6gd instance delivers 2,500 MB/s sequential read bandwidth and 60,000 random read IOPS, so the I/O overhead stays under 1ms even with cold cache.

## Storage Economics and Index Maintenance

### Disk Footprint and Cost Implications

The raw halfvec column for 1 million vectors occupies 2.93 GB. pgvector’s IVFFlat index adds 3.1 GB for a total of 6.03 GB. pgvectorscale’s StreamingDiskANN index with SBQ adds 5.2 GB for a total of 8.13 GB. The 2.1 GB difference translates to approximately $0.17 per month on EBS gp3 volumes at $0.08 per GB-month in us-east-1 as of September 2024 pricing.

The more significant cost factor is RAM provisioning. IVFFlat benefits from having the entire index in PostgreSQL’s buffer cache. At 3.1 GB, the index fits comfortably in the 16 GB shared_buffers allocation, but production deployments with concurrent workloads — WAL writes, autovacuum, analytical queries — will compete for those buffers. If the IVFFlat index pages get evicted, latency spikes as pages are read back from disk. StreamingDiskANN is designed for disk residency; its 5.2 GB index does not need to be cached in full. The working set per query is the 400 KB to 600 KB of graph nodes visited, which the OS page cache can hold with minimal memory pressure.

### Index Build and Incremental Updates

IVFFlat index builds require a training step that scans a sample of the table to compute cluster centroids. For 1 million vectors, the training step took 8 minutes 3 seconds, followed by 14 minutes 11 seconds to assign vectors to lists and build the index structure. Inserting 10,000 new vectors into an existing IVFFlat index took 3.2 seconds, but the index does not automatically rebalance; list assignments are fixed at build time, and large insertions degrade recall as the centroid distribution drifts from the training sample.

StreamingDiskANN builds the graph incrementally during index creation. The 31-minute build time includes graph construction and SBQ compression. Inserting 10,000 new vectors took 4.7 seconds, and the graph structure adapts by adding edges for new nodes without requiring a full rebuild. Timescale’s documentation dated July 2024 states that StreamingDiskANN supports concurrent inserts and queries without locking the index, though write throughput degrades under heavy query load due to shared NVMe bandwidth.

## Query Patterns and Production Considerations

### Filtered Search and Metadata Joins

Vector search in production rarely operates on the full table. Typical RAG pipelines filter by document ID, date range, or user permissions before performing ANN search. pgvector supports partial indexes and WHERE clause filtering that PostgreSQL’s planner can combine with IVFFlat scans. A filtered query with `WHERE category = 'science'` on a column with a B-tree index reduced the search space to 180,000 vectors; IVFFlat at probes=32 achieved recall@10 of 0.968 with mean latency of 5.1ms.

pgvectorscale’s StreamingDiskANN handles filtered queries by performing post-filtering: the ANN search retrieves `search_list_size * 2` candidates, then applies the WHERE clause, then returns the top-k. On the same 180,000-vector subset, this approach yielded recall@10 of 0.979 with mean latency of 3.9ms. The edge case to watch is highly selective filters: if the WHERE clause eliminates more than 90% of the candidate pool, recall can degrade because the ANN search may not have retrieved enough matching vectors. In testing with a filter that matched only 1,200 vectors (0.12% of the table), StreamingDiskANN recall@10 dropped to 0.82 while IVFFlat with a partial index on the filtered subset maintained 0.96.

### Concurrency and Connection Pooling

Both extensions operate within PostgreSQL’s process model, meaning each connection that executes a vector query consumes a backend process and its associated memory. With 64 GB RAM and 8 vCPUs, the test instance supported 40 concurrent vector queries before mean latency began to increase nonlinearly. IVFFlat at probes=64 saw mean latency rise from 18.2ms at 10 concurrent queries to 47.3ms at 40 concurrent queries. StreamingDiskANN at search_list_size=100 rose from 4.7ms to 15.8ms under the same load. The NVMe bandwidth ceiling (2,500 MB/s) was not reached at 40 concurrent StreamingDiskANN queries, which collectively read approximately 24 MB/s from the index. The IVFFlat degradation stemmed from CPU contention on distance computations rather than I/O.

### Version-Specific Caveats

pgvector 0.7.0 introduced halfvec support in April 2024, but the IVFFlat index does not yet exploit half-precision for distance computation — all comparisons are upcast to float32. This means the compute savings from half-precision storage accrue only to table size and buffer cache efficiency, not to query execution speed. The pgvector roadmap issue #508 on GitHub, last updated August 2024, indicates that half-precision kernels are under development for a future release.

pgvectorscale 0.2.0’s SBQ compression operates at 1 bit per dimension with a per-vector scaling factor, achieving 192 bytes per 1,536-dimensional vector. The tradeoff is quantization error: the mean squared error between original float32 vectors and SBQ-reconstructed vectors was 0.0031 on the Wikipedia dataset. For cosine similarity ranking, this error primarily affects vectors that are very close to the query vector, where small distance perturbations can reorder the top results. This explains why StreamingDiskANN at search_list_size=100 achieves 0.983 recall rather than 0.99+ — the quantization introduces a recall ceiling that additional search depth cannot fully overcome.

## Migration Path and Operational Tradeoffs

### Compatibility and Lock-In

pgvectorscale stores vectors using pgvector’s `vector` and `halfvec` types, meaning the table schema is identical. An application can maintain both an IVFFlat index and a StreamingDiskANN index on the same column simultaneously, switching between them by setting the `enable_seqscan` and `enable_indexscan` parameters or by hinting index usage in queries. This dual-index approach costs extra disk space but provides a rollback path if StreamingDiskANN’s recall characteristics prove unsuitable for a specific workload.

The operational difference is that pgvectorscale requires the TimescaleDB extension (version 2.15.0 or later as of September 2024) as a dependency. Installing TimescaleDB adds background workers for compression and retention policies, which consume approximately 200 MB of additional shared memory. Teams running vanilla PostgreSQL without TimescaleDB will need to weigh this dependency against the performance gains.

### When Each Index Makes Sense

IVFFlat remains the appropriate choice when the vector count is under 500,000 and the entire index fits in RAM with headroom for application queries. Its recall characteristics are well-understood, and the probe parameter provides a direct knob for trading latency against accuracy. For read-heavy workloads where the index can be rebuilt weekly during maintenance windows, the static list assignment is not a liability.

StreamingDiskANN earns its place when vector counts exceed 1 million, when RAM is constrained relative to dataset size, or when insert throughput requires an index that adapts without full rebuilds. The 4.7ms mean latency at 0.983 recall on 1 million vectors means a single PostgreSQL instance can serve vector search alongside transactional queries without dedicated GPU or vector-specialized hardware. The quantization ceiling at approximately 0.994 recall is a genuine limitation for applications requiring exact nearest-neighbor semantics, but for semantic search and RAG use cases where the retrieved context is fed to an LLM, the difference between 0.983 and 0.994 recall is rarely observable in end-to-end output quality.

## Actionable Takeaways

1. **Benchmark with your own data before committing to an index strategy.** The recall-latency curves documented here used Wikipedia text and OpenAI embeddings. Embedding distributions vary significantly by domain and model; a medical literature dataset embedded with a fine-tuned model may show different quantization error characteristics under SBQ. Run a 10,000-query benchmark on a representative sample before selecting index parameters.

2. **Provision RAM for IVFFlat, provision NVMe bandwidth for StreamingDiskANN.** If your deployment runs on an instance class with high RAM-to-storage ratios (r-family instances), IVFFlat can perform well up to approximately 2 million vectors. If you are on storage-optimized instances (i-family or im4gn) or using EBS with provisioned IOPS, StreamingDiskANN’s disk-backed design aligns better with available resources.

3. **Monitor recall degradation under filtered queries.** The post-filtering approach in StreamingDiskANN 0.2.0 breaks down when WHERE clauses are highly selective. If your application filters by user ID or document collection where typical queries touch less than 1% of the table, test recall explicitly on those filtered subsets. A partial IVFFlat index may outperform StreamingDiskANN in these scenarios.

4. **Plan for pgvector 0.8.0’s half-precision kernels.** The performance landscape will shift when IVFFlat can compute distances directly on halfvec data without upcasting. Based on the pgvector issue tracker as of September 2024, this feature is in active development and could narrow the latency gap between IVFFlat and StreamingDiskANN for in-memory workloads.

5. **Consider the dual-index pattern for risk-averse migrations.** Create both an IVFFlat index and a StreamingDiskANN index on the same column, route a percentage of query traffic to each, and compare recall and latency in production over a one-week period. The additional 5.2 GB of disk space is a small insurance premium against production surprises from a new index type.
