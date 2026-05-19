---
title: "Vertex AI Matching Engine vs AWS OpenSearch Serverless: Vector Search for Recommendation Systems"
description: "As of March 2025, AWS OpenSearch Serverless changed its cost model for vector workloads. The service no longer charges for redundant copies of vector indexes…"
category: "Vector Databases"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T11:11:58Z"
modDatetime: "2026-05-18T11:11:58Z"
readingTime: 10
tags: ["Vector Databases"]
---

As of March 2025, AWS OpenSearch Serverless changed its cost model for vector workloads. The service no longer charges for redundant copies of vector indexes across Availability Zones in production deployments. This adjustment arrived six months after Google Cloud reduced Matching Engine index rebuild costs by 40% for deployments exceeding 10 million vectors. For teams running recommendation systems at scale, the math on vector search infrastructure flipped twice in a single fiscal year. A cluster handling 50 million 768-dimensional embeddings under the old OpenSearch Serverless pricing could run S$3,200 per month in compute alone. Under the revised March 2025 pricing, that same workload dropped to S$1,850. Matching Engine, priced at S$0.025 per node-hour for the e2-standard-8 configuration as of October 2024, now lands within 8% of OpenSearch Serverless for workloads between 10 million and 100 million vectors. The gap widens again at the 500 million vector mark, where Matching Engine’s sharded index architecture avoids the cross-node query fan-out that drives up OpenSearch Serverless latency and cost. The decision is no longer about which service handles vector search. Both do. The question is which pricing model, index update cadence, and query latency profile fits a production recommendation pipeline that updates candidate embeddings every 90 minutes and serves 4,000 queries per second at p99 latency under 45 milliseconds.

## Index Architecture and Update Semantics

Vector search for recommendation systems differs from semantic document retrieval in one critical dimension: index freshness. A product catalog embedding pipeline regenerates vectors whenever inventory, pricing, or user behavior signals shift. In high-velocity e-commerce, that means index rebuilds every 60 to 120 minutes. The two services approach this problem from opposite architectural philosophies.

### Matching Engine: Approximate Nearest Neighbor with Deterministic Sharding

Matching Engine builds an approximate nearest neighbor index using Google’s ScaNN algorithm, which combines tree quantization with asymmetric hashing. The index is partitioned across nodes using a deterministic sharding scheme. Each shard owns a contiguous slice of the vector space. When a query arrives, Matching Engine routes it to the single shard responsible for that region, plus one adjacent shard if the query lands near a boundary. This two-shard fan-out is fixed regardless of corpus size.

The practical consequence is that query latency stays flat as the index grows. A deployment with 10 million vectors and one with 500 million vectors both touch exactly two shards per query. Google published benchmarks in its October 2024 Matching Engine documentation showing p99 latency of 12 milliseconds at 100 million vectors and 14 milliseconds at 500 million vectors, both measured on e2-standard-8 nodes with 4 vCPUs and 32 GB RAM. The trade-off is index rebuild time. A full rebuild of a 100 million vector index on Matching Engine takes 45 to 60 minutes because ScaNN re-clusters the entire dataset. Incremental updates are not supported in the current GA release as of March 2025. Teams must run a full index rebuild on a cadence that matches their data freshness requirements, then atomically swap the new index into production via the `deployed_index` endpoint.

### OpenSearch Serverless: Incremental Segment Merging

OpenSearch Serverless vector search uses the FAISS engine under the hood, wrapped inside OpenSearch’s segment-based indexing model. New vectors land in a write-ahead log and flush to immutable segments. Background merge jobs combine small segments into larger ones, rebuilding the HNSW graph incrementally. This means new vectors become searchable within 2 to 5 seconds of ingestion, not 45 minutes later.

The cost of this freshness is query fan-out. A query against an OpenSearch Serverless collection must probe every segment that has not yet been merged. In a high-ingest pipeline pushing 50,000 vectors per hour, the segment count can reach 200 or more before the next merge cycle completes. Each segment maintains its own HNSW graph. The query planner fans out to all segments, collects candidates, and re-ranks. AWS documentation from January 2025 notes that query latency scales linearly with segment count. At 50 segments, p99 latency measured 22 milliseconds on a collection with 50 million 768-dimensional vectors. At 200 segments, p99 exceeded 60 milliseconds. For a recommendation system serving 4,000 queries per second, that variance pushes tail latency past the 45-millisecond threshold where user-facing ranking pipelines degrade.

## Cost Modeling at Three Scale Breakpoints

List pricing for both services is public and dated. Matching Engine charges per node-hour for index-serving nodes and per gigabyte-month for stored vectors. OpenSearch Serverless charges per OCU-hour for both indexing and search, plus per gigabyte-month for managed storage. The March 2025 pricing change eliminated charges for redundant index copies, which previously doubled the effective OCU count for production workloads.

### 10 Million Vectors: Freshness Premium

At 10 million 768-dimensional vectors, raw storage is 28.8 GB. Matching Engine requires a minimum of 2 e2-standard-8 nodes for serving, priced at S$0.025 per node-hour each as of October 2024 Google Cloud pricing. Monthly serving cost: 2 × S$0.025 × 730 hours = S$36.50. Storage cost: 28.8 GB × S$0.12 per GB-month = S$3.46. Total: S$39.96 per month. Index rebuild cost adds S$8.76 for a 4-hour rebuild window using the same node type.

OpenSearch Serverless at this scale uses 2 indexing OCUs and 4 search OCUs for a production deployment, per AWS sizing guidance from January 2025. Indexing OCUs cost S$0.24 per OCU-hour. Search OCUs cost S$0.24 per OCU-hour. Monthly compute: (2 + 4) × S$0.24 × 730 = S$1,051.20. Storage: 28.8 GB × S$0.024 per GB-month = S$0.69. Total: S$1,051.89. The 26× cost differential reflects OpenSearch Serverless’s minimum OCU footprint, which does not scale down below 2 indexing OCUs even for small collections. Matching Engine wins decisively at this scale on cost, but OpenSearch Serverless offers sub-5-second index freshness that Matching Engine cannot match.

### 100 Million Vectors: The Crossover Point

At 100 million vectors, storage reaches 288 GB. Matching Engine serving requires 8 e2-standard-8 nodes. Monthly serving: 8 × S$0.025 × 730 = S$146.00. Storage: 288 × S$0.12 = S$34.56. Total: S$180.56. Rebuild cost for a 6-hour window on 16 nodes: S$17.52.

OpenSearch Serverless at 100 million vectors typically runs 8 indexing OCUs and 16 search OCUs under sustained load. Monthly compute: (8 + 16) × S$0.24 × 730 = S$4,204.80. Storage: 288 × S$0.024 = S$6.91. Total: S$4,211.71. The gap narrows to 23× but remains substantial. However, OpenSearch Serverless’s March 2025 pricing change removed a S$2,100 monthly charge for redundant index copies that previously applied at this scale. The effective cost dropped from S$6,311.71 to S$4,211.71, a 33% reduction.

### 500 Million Vectors: Sharding Advantage

At 500 million vectors, storage is 1.44 TB. Matching Engine serving uses 32 e2-standard-8 nodes. Monthly serving: 32 × S$0.025 × 730 = S$584.00. Storage: 1,440 × S$0.12 = S$172.80. Total: S$756.80. Rebuild cost for an 8-hour window on 64 nodes: S$116.80.

OpenSearch Serverless at this scale requires 32 indexing OCUs and 64 search OCUs to maintain p99 latency under 50 milliseconds, based on the linear segment fan-out behavior described in AWS documentation. Monthly compute: (32 + 64) × S$0.24 × 730 = S$16,819.20. Storage: 1,440 × S$0.024 = S$34.56. Total: S$16,853.76. The cost ratio reaches 22×. More critically, query latency becomes difficult to bound. The segment count under heavy ingest can spike to 400 or more between merge cycles, pushing p99 latency past 80 milliseconds. For a recommendation system with a 45-millisecond p99 budget, OpenSearch Serverless requires aggressive merge scheduling that reduces index freshness to 15 to 30 minutes, eroding its primary architectural advantage.

## Query Performance Under Recommendation Load

Recommendation queries differ from semantic search in two ways: they are highly concurrent and they often include metadata filters. A typical product recommendation query retrieves the top 100 nearest neighbors for a user embedding, then filters out out-of-stock items, already-purchased items, or items outside a price range. Both services support pre-filtering and post-filtering, but the performance implications diverge.

### Matching Engine: Pre-Filtering with Token-Based Access

Matching Engine supports boolean pre-filtering using token-based access control lists attached to each vector at index time. When a query specifies a filter, Matching Engine applies it before distance computation, reducing the candidate set. Google’s October 2024 documentation shows p99 latency of 18 milliseconds for a filtered query against 100 million vectors with a filter that eliminates 70% of candidates. The sharding architecture means the filter applies only on the two shards touched by the query, so filter evaluation cost is constant.

The limitation is that token-based filters are static at index time. If a product goes out of stock, the filter token must be updated via a full index rebuild. Dynamic filtering on fields that change between rebuilds requires post-filtering, which Matching Engine handles by retrieving 2× to 3× the requested neighbor count and then applying the filter client-side. This increases result size overhead but not query latency, since the extra candidates are returned in the same network call.

### OpenSearch Serverless: Dynamic Filtering with Segment Overhead

OpenSearch Serverless supports arbitrary boolean filters on any indexed field, evaluated dynamically at query time. This is the service’s strongest advantage for recommendation systems with rapidly changing metadata. An out-of-stock flag can be toggled in the document without touching the vector index. The filter applies during the segment-level search, pruning candidates before distance computation.

The cost is that filter evaluation fans out to every segment, just like the vector search itself. AWS’s January 2025 performance guide notes that a filtered query against 100 million vectors with a 70% selectivity filter adds 8 to 12 milliseconds of overhead compared to an unfiltered query, because the filter must be evaluated against the candidate pool from each segment before merging. At 200 segments, this overhead pushes p99 latency from 60 milliseconds to 72 milliseconds. For recommendation pipelines that require sub-45-millisecond p99, this forces a choice between index freshness and query latency.

## Operational Maturity and Failure Modes

Both services are GA and carry SLAs. Matching Engine is covered under the Google Cloud Vertex AI SLA with 99.9% monthly uptime commitment as of March 2025. OpenSearch Serverless is covered under the AWS OpenSearch Service SLA with the same 99.9% commitment. The operational differences emerge in failure modes and recovery paths.

Matching Engine’s index rebuild is a batch operation. If a rebuild fails 40 minutes into a 60-minute job, the previous index remains serving. The failure mode is stale data, not downtime. Teams running hourly rebuilds can tolerate one failed rebuild and retry on the next cycle without user impact. The atomic swap mechanism means the new index replaces the old one with zero query interruption.

OpenSearch Serverless handles node failures transparently through OCU auto-scaling. If a search OCU fails, AWS replaces it within 90 seconds and redistributes shards. During that window, query capacity drops but queries do not fail. The failure mode is elevated latency, not errors. For recommendation systems, a 90-second window of p99 latency at 120 milliseconds instead of 45 milliseconds is typically acceptable if the client implements circuit breakers and graceful degradation.

The less visible failure mode in OpenSearch Serverless is segment explosion. If the merge scheduler falls behind ingestion rate, segment count grows unbounded. AWS’s service limits cap segments at 1,000 per index, at which point writes are throttled. A recommendation pipeline ingesting 100,000 vectors per hour can hit this limit in 10 hours if merges stall. Monitoring segment count and setting alerts at 500 segments is essential for production deployments.

## Closing Takeaways

First, cost modeling must account for the March 2025 OpenSearch Serverless pricing change. Teams that evaluated the service in 2024 and dismissed it on cost should re-run the numbers. At 100 million vectors, the 33% reduction brings it closer to Matching Engine for workloads that need dynamic metadata filtering and sub-5-second index freshness. The cost gap remains large, but the freshness capability may justify it for high-velocity catalogs.

Second, choose Matching Engine when query latency must stay under 20 milliseconds p99 at any scale and index freshness of 60 minutes is acceptable. The fixed two-shard fan-out means latency does not degrade as the corpus grows from 10 million to 500 million vectors. The rebuild-only update model is the binding constraint. If the business can tolerate 60-minute data staleness, Matching Engine delivers predictable performance at 22× lower cost at the 500 million vector scale.

Third, choose OpenSearch Serverless when metadata filters change faster than index rebuild cycles. The dynamic filtering capability eliminates the need to rebuild indexes when product attributes change. The trade-off is latency variance driven by segment count. Teams must implement merge monitoring and potentially sacrifice index freshness by forcing frequent merges to keep segment count below 50, which brings p99 latency into the 22-millisecond range at 50 million vectors.

Fourth, do not deploy either service without benchmarking against your actual query pattern and data distribution. Both Google and AWS publish benchmarks on uniformly distributed random vectors. Real recommendation embeddings exhibit clustering that degrades approximate nearest neighbor recall. Run recall@100 measurements on a 10 million vector sample of production embeddings before committing to an index configuration. A 92% recall on random data can drop to 78% on clustered e-commerce embeddings.

Fifth, plan for the index rebuild cost in Matching Engine and the segment merge cost in OpenSearch Serverless as first-class budget items. A 500 million vector Matching Engine deployment spending S$116.80 per rebuild running 6 times daily adds S$700.80 per month in rebuild compute. An OpenSearch Serverless deployment forcing aggressive merges to maintain latency budgets burns additional indexing OCU-hours that can add 15% to 20% to the monthly compute bill. Both costs are visible in billing data but often missed in initial architecture estimates.
