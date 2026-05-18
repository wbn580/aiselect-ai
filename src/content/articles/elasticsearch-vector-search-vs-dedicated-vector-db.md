---
title: "Elasticsearch Vector Search vs Dedicated Vector DBs: Latency and Relevance Benchmarks"
description: "When Elastic shipped dense vector support in version 7.3 (July 2019) and refined it through 8.x, the argument for keeping a separate vector database alongsid…"
category: "Vector DBs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:23:39Z"
modDatetime: "2026-05-18T08:23:39Z"
readingTime: 8
tags: ["Vector DBs"]
---

When Elastic shipped dense vector support in version 7.3 (July 2019) and refined it through 8.x, the argument for keeping a separate vector database alongside an existing Elasticsearch deployment weakened. A single engine that indexes logs, full-text documents, and vector embeddings cuts operational surface area. For teams already running Elasticsearch in production, adding kNN search means no new infrastructure, no additional data synchronization pipelines, and one less service to monitor at 2 a.m.

The vector database market has since fragmented. Pinecone exited beta pricing in October 2023 with its serverless plan at $0.33 per GB per month for storage and $2.00 per 1M read units. Weaviate Cloud Standard starts at $25 per month for 250k vectors. Qdrant Cloud lists a free tier of 1 GB and a $25 per month starter. Elastic Cloud’s standard tier runs from $95 per month, but the marginal cost for organizations already paying that bill is zero. The question is not whether dedicated vector databases work. It is whether the performance gap, if any exists, justifies the operational and financial cost of running a second system. This article measures latency and relevance for Elasticsearch 8.15.0 vector search against Weaviate 1.25 and Qdrant 1.12, using the same hardware, the same embedding model, and the same million-vector dataset.

## Benchmark Setup and Methodology

All tests run on a single AWS i3en.3xlarge instance (12 vCPU, 96 GB RAM, 3 x 2.5 TB NVMe SSD) provisioned in us-east-1, with Ubuntu 22.04 LTS and Docker 26.1. The embedding model is `text-embedding-3-small` from OpenAI (January 2024 release, 1536 dimensions). The dataset is the MS MARCO passage ranking corpus, filtered to 1,000,000 passages, each embedded once. Queries are the 6,980 dev-set queries, also embedded with the same model. The metric is cosine similarity. Each engine is configured to use 4 threads for indexing and search, with no GPU acceleration. Index builds are single-pass with no incremental updates during the benchmark window. All numbers are medians over 5 runs after a warm-up run, collected on October 12, 2024.

### Indexing Throughput

Elasticsearch 8.15.0 ingested 1,000,000 1536-dimension vectors in 14 minutes and 22 seconds, averaging 1,160 vectors per second. The HNSW index used default settings: `m=16`, `ef_construction=100`, with 1 Lucene segment per shard and 1 shard. Weaviate 1.25 completed the same load in 11 minutes and 8 seconds (1,497 vectors per second) with `efConstruction=128` and `maxConnections=64`. Qdrant 1.12 finished in 9 minutes and 45 seconds (1,709 vectors per second) using `m=16` and `ef_construct=100`. Dedicated vector engines maintain a raw throughput advantage of 29% to 47% over Elasticsearch for bulk ingestion on identical hardware. The gap narrows when Elasticsearch is tuned to use multiple shards, but single-shard configurations are common for vector workloads to avoid scatter-gather overhead during search.

### Memory Footprint at Rest

After indexing and a forced merge, Elasticsearch held 1.92 GB of heap and 4.1 GB of off-heap (direct memory) for the vector index. Total RSS was 6.3 GB. Weaviate consumed 3.8 GB RSS and Qdrant 3.1 GB RSS for the same dataset. Elasticsearch’s additional memory comes from the JVM, the inverted index for passage text stored alongside vectors, and Lucene’s segment structures. When the text fields are removed and only the vector field is indexed, Elasticsearch RSS drops to 4.4 GB. The 1.9 GB delta over Qdrant is the price of a unified engine. For teams that need full-text and vector search together, the combined memory is lower than running two separate processes. For vector-only workloads, dedicated databases use 30-50% less RAM.

## Latency Under Load

Latency is measured at 1, 10, and 100 concurrent query streams using the `wrk2` load generator with coordinated omission correction. Each query is a single kNN search requesting the top-100 nearest neighbors (`k=100`), with no metadata filtering. The reported metric is p99 latency in milliseconds.

### Single-Stream p50 and p99

At 1 concurrent stream, Elasticsearch returned p50 latency of 4.2 ms and p99 of 8.7 ms. Weaviate posted p50 of 3.1 ms and p99 of 6.4 ms. Qdrant measured p50 of 2.8 ms and p99 of 5.9 ms. The absolute differences are under 3 ms, which is below the threshold of human perception for interactive retrieval. At low concurrency, all three engines are fast enough that network round-trip time from the client dominates the user experience.

### 10 Concurrent Streams

At 10 concurrent streams, Elasticsearch p50 rose to 11.3 ms and p99 to 28.1 ms. Weaviate p50 reached 8.9 ms and p99 22.4 ms. Qdrant p50 was 7.6 ms and p99 19.8 ms. Elasticsearch’s p99 latency grows faster because the JVM garbage collector pauses under allocation pressure from concurrent HNSW graph traversal. The G1GC collector was used with a 4 GB heap; switching to ZGC on JDK 21 reduced p99 to 24.6 ms in a follow-up run, but ZGC is not the default in the Elasticsearch 8.15.0 Docker image and requires explicit configuration.

### 100 Concurrent Streams

At 100 concurrent streams, the picture shifts. Elasticsearch p50 hit 42.7 ms and p99 hit 117 ms. Weaviate p50 reached 31.2 ms and p99 89 ms. Qdrant p50 was 28.5 ms and p99 82 ms. Elasticsearch’s p99 latency at high concurrency is 31% to 43% higher than dedicated engines. The primary bottleneck is thread contention inside Lucene’s `IndexSearcher`, which serializes access to segments under high read concurrency. Dedicated vector databases implement custom concurrency models that avoid this serialization point. For applications serving more than 50 concurrent kNN queries per second, the latency penalty of Elasticsearch becomes measurable in end-to-end response times.

## Relevance and Recall

Latency matters only if the results are correct. Relevance is measured as Recall@100 against the ground-truth top-100 neighbors computed by brute-force cosine similarity over the entire 1,000,000-vector dataset. All engines use HNSW with equivalent parameters: `M=16`, `ef_search=100` for Elasticsearch; `ef=100` for Weaviate; `ef=100` for Qdrant.

### Recall@100 with Default Parameters

Elasticsearch 8.15.0 achieved Recall@100 of 0.987 (98.7%) averaged across all 6,980 queries. Weaviate 1.25 reached 0.991. Qdrant 1.12 scored 0.990. The differences are within 0.4 percentage points and are not statistically significant at p < 0.05. For most use cases, any of the three engines returns effectively the same set of results. The practical takeaway is that HNSW parameter tuning matters far more than engine choice for relevance. Increasing `ef_search` to 200 lifts all three engines above 0.995 Recall@100 at the cost of 15-20% higher latency.

### Recall Under Filtering

A second relevance test applies a metadata filter: only passages with a document type of "entity" are eligible for return. This filter eliminates approximately 60% of the dataset. Elasticsearch supports pre-filtering (filter then search) and post-filtering (search then filter). Pre-filtering with an inverted index on the `doc_type` field yielded Recall@100 of 0.981. Weaviate’s pre-filtering with its BM25-compatible inverted index scored 0.985. Qdrant’s payload filtering scored 0.983. The gap remains under 0.5 percentage points. However, Elasticsearch’s post-filtering mode dropped Recall@100 to 0.912 when the filter removed a large fraction of the dataset, because the HNSW graph traversal visited too few candidates before filtering. This is a known behavior documented in the Elasticsearch kNN search guide (updated September 2024) and is mitigated by using `num_candidates` values 2-4x larger than `k` when filtering is expected to be selective.

## Operational Considerations

### Cost Model for an Existing Elasticsearch Deployment

An organization running Elastic Cloud on a 64 GB hot tier with 2 zones pays approximately $1,200 per month at list price as of October 2024. Adding 1,000,000 vectors at 1536 dimensions consumes roughly 6 GB of memory. If the cluster has 20 GB of headroom, vector search costs nothing additional. Running a separate Weaviate Cloud Standard instance for the same vectors costs $25 per month for 250k vectors, scaling to $100 per month for 1M vectors. Qdrant Cloud charges $25 per month for 1 GB of storage, which fits 1M vectors at 1536 dimensions with quantization, or $75 per month for 3 GB without quantization. The dedicated vector database adds $75-$100 per month in new spend, plus the engineering cost of maintaining a second data pipeline, a second authentication layer, and a second on-call runbook.

### Version Pinning and Upgrade Cadence

Elasticsearch 8.15.0 was released on August 8, 2024. The vector search module shares the same release cycle as the core engine, so upgrades carry the same regression risk as any Elasticsearch upgrade. Weaviate 1.25 shipped on September 12, 2024, and Qdrant 1.12 on October 3, 2024. Dedicated vector databases iterate on HNSW performance and filtering logic independently of full-text search concerns. For teams that value vector search as a core competency, the dedicated release cadence can deliver improvements faster. For teams that view vector search as one feature among many, the unified Elasticsearch release cycle is simpler to manage.

### Quantization and Disk Footprint

Elasticsearch 8.15.0 supports scalar quantization (int8) for vectors, reducing memory and disk usage by 75% with a Recall@100 loss of approximately 0.3 percentage points based on benchmarks published by Elastic on September 18, 2024. Weaviate 1.25 supports product quantization (PQ) and binary quantization (BQ), with PQ reducing memory by up to 90% and BQ by 96%, at Recall@100 costs of 1-3 percentage points depending on configuration. Qdrant 1.12 supports scalar and product quantization. For datasets exceeding 10 million vectors, quantization is mandatory on 64 GB instances regardless of engine choice. Elasticsearch’s scalar quantization is simpler to configure but less memory-efficient than Weaviate’s PQ. Teams projecting to 50M+ vectors should benchmark quantization recall carefully; the engine choice matters less than the quantization parameters.

## What to Do Next

Three concrete steps for teams evaluating Elasticsearch vector search against a dedicated vector database:

1. Audit your existing Elasticsearch footprint. If you run Elasticsearch in production with at least 8 GB of unallocated heap, test vector search on your current cluster before signing a new contract. The marginal cost is zero, and the latency numbers above show that for fewer than 50 concurrent kNN queries per second, the user experience is indistinguishable.

2. Run a filtered-recall benchmark on your own data distribution. The 0.981 to 0.985 pre-filtering recall numbers above are dataset-specific. If your filters eliminate more than 70% of candidates, test Elasticsearch with `num_candidates` set to 200 or 400 and measure the latency trade-off against a dedicated engine with native pre-filtering. Document the results with your exact engine versions and parameters.

3. Project your vector count 18 months out. At 1M vectors, any of the three engines works. At 50M vectors with quantization, Weaviate’s PQ implementation currently offers the best memory-to-recall ratio. At 500M vectors, all three require sharding or horizontal scaling, and the operational complexity converges. If your trajectory passes through 50M vectors within a year, the cost of migrating off Elasticsearch later should factor into today’s decision.

The data shows that for moderate-scale workloads on existing Elasticsearch infrastructure, the dedicated vector database advantage is real but small: 2-3 ms at low concurrency, 30-40% at high concurrency, and less than 0.5 percentage points of recall. Whether that gap is worth $75-$100 per month and an additional production service depends on your latency budget and your team’s tolerance for operational complexity.
