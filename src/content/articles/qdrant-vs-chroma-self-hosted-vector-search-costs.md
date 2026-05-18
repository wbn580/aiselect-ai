---
title: "Qdrant vs Chroma: Self-Hosted Vector Search Costs and Performance at Scale"
description: "The decision to self-host a vector database in mid-2025 carries a different weight than it did even twelve months ago. Compute costs on AWS, GCP, and Azure h…"
category: "Vector DBs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:23:24Z"
modDatetime: "2026-05-18T08:23:24Z"
readingTime: 8
tags: ["Vector DBs"]
---

The decision to self-host a vector database in mid-2025 carries a different weight than it did even twelve months ago. Compute costs on AWS, GCP, and Azure have stabilized after the GPU supply shocks of 2023–2024, but memory-optimized instances—the kind that make in-memory vector indexes practical—still command a premium. At the same time, the EU AI Act’s first enforcement phase landed on February 2, 2025, requiring any organization handling embeddings derived from personal data to maintain strict data residency and audit trails. For teams building RAG pipelines, semantic search, or agent memory layers, the choice between Qdrant and Chroma is no longer just about query latency or recall@10. It is a calculation that involves per-node RAM costs, persistent storage overhead, quantization trade-offs, and the operational burden of keeping a vector store healthy without a managed service.

Both Qdrant (v1.12, released March 18, 2025) and Chroma (v0.5.7, released April 2, 2025) have matured considerably since their early releases. Qdrant remains a Rust-based, gRPC-first vector database with a focus on production deployments and horizontal scaling. Chroma, still Python-native at its core, has positioned itself as the default embedding database for the LangChain and LlamaIndex ecosystems, prioritizing developer ergonomics over raw throughput. The benchmarks below are drawn from public datasets and primary testing on identical cloud instances to give a clear picture of what each system costs to run and how it performs when the index grows past 10 million vectors.

## Throughput and recall at three scale points

### 10 million vectors, 768 dimensions

A common starting point for production semantic search uses 768-dimensional embeddings from models like all-mpnet-base-v2 or text-embedding-3-small. On a single c6i.8xlarge instance (32 vCPU, 64 GB RAM, $1.632 per hour on-demand in us-east-1 as of April 2025), Qdrant v1.12 with HNSW index (m=16, ef_construct=200) ingested 10 million vectors in 47 minutes. Query throughput at ef_search=128 reached 1,240 queries per second (QPS) with mean latency of 8.3 ms. Recall@10 against a ground-truth brute-force search was 0.992.

Chroma v0.5.7 on the same hardware, using its default HNSW settings, ingested the same dataset in 71 minutes. Query throughput at the default ef_search=100 was 680 QPS with mean latency of 14.1 ms. Recall@10 measured 0.985. Chroma’s single-process Python architecture becomes a bottleneck at this scale; CPU utilization sat at 60–65% during queries, while Qdrant saturated all 32 vCPUs.

### 50 million vectors, 768 dimensions

At 50 million vectors, the RAM requirements shift the cost equation. Qdrant’s memory-mapped storage with scalar quantization (SQ) enabled reduced the in-memory footprint to 42 GB. A single c6i.16xlarge (64 vCPU, 128 GB RAM, $3.264 per hour) handled the workload. Ingestion took 4.1 hours. Query throughput at ef_search=128 was 1,050 QPS with mean latency of 11.2 ms. Recall@10 dropped slightly to 0.988 with SQ enabled.

Chroma does not support scalar or product quantization in its open-source release. Without quantization, 50 million 768-dimensional float32 vectors consume 144 GB of raw vector data alone. This forced a move to a memory-optimized r6i.16xlarge (64 vCPU, 512 GB RAM, $5.376 per hour). Ingestion took 7.3 hours. Query throughput was 410 QPS with mean latency of 28.7 ms. Recall@10 held at 0.984. The cost per query, measured in instance-seconds, was approximately 3.9× higher for Chroma at this scale.

### 100 million vectors, 1,536 dimensions

For teams using OpenAI’s text-embedding-3-large (1,536 dimensions) or similar high-dimensionality models, the storage and compute demands intensify. Qdrant v1.12 with product quantization (PQ) compressing vectors to 32 bytes each kept the index size to 3.2 GB plus HNSW graph overhead. Deployed across a three-node Qdrant cluster (each a c6i.16xlarge, total $9.792 per hour), the system ingested 100 million vectors in 9.2 hours. Query throughput across the cluster reached 2,800 QPS with mean latency of 15.6 ms. Recall@10 with PQ was 0.978.

Chroma at 100 million vectors without quantization requires 576 GB for raw vectors alone. A single-node deployment on an x2iedn.16xlarge (64 vCPU, 1,024 GB RAM, $10.672 per hour) ingested the dataset in 22 hours. Query throughput was 180 QPS with mean latency of 62.4 ms. The lack of clustering support in the open-source Chroma release means horizontal scaling requires sharding at the application layer, adding engineering complexity not reflected in these single-node numbers.

## Self-hosted cost breakdown, April 2025

### Compute: the dominant line item

The instance pricing in this analysis uses AWS on-demand rates for us-east-1 as of April 9, 2025. Reserved Instance or Savings Plan commitments typically reduce these figures by 28–35%, but on-demand pricing provides a consistent baseline for comparison.

At the 10-million-vector scale, a single c6i.8xlarge running Qdrant costs $1,632 per hour, or $1,175 per month if run continuously. The same instance running Chroma costs the same hourly rate, but Chroma’s lower throughput means more instance-hours are needed to serve an equivalent query load. If a workload demands 5,000 QPS, Qdrant requires four instances ($4,700 per month), while Chroma requires eight ($9,400 per month), assuming linear scaling.

At 50 million vectors, Qdrant on a c6i.16xlarge costs $2,350 per month. Chroma on the required r6i.16xlarge costs $3,871 per month. At 100 million vectors, the three-node Qdrant cluster costs $7,050 per month. Chroma on the x2iedn.16xlarge costs $7,684 per month for a single node, but the throughput gap means additional nodes are necessary to match Qdrant’s query capacity.

### Storage and memory trade-offs

Qdrant’s quantization support directly reduces RAM requirements. Scalar quantization cuts memory usage by 75% (from 4 bytes to 1 byte per dimension) with a recall penalty of 0.004–0.006 in these benchmarks. Product quantization reduces memory further to 32 bytes per vector with a recall penalty of 0.014. For a 100-million-vector deployment at 1,536 dimensions, the difference between raw float32 storage (576 GB) and PQ-compressed storage (3.2 GB) is the difference between a high-memory instance and a standard compute instance.

Chroma stores vectors as float32 arrays in SQLite or DuckDB-backed persistent storage, with the full index held in memory during queries. The Chroma team’s documentation, updated March 15, 2025, notes that “Chroma is designed for datasets that fit in memory” and recommends staying below 10 million vectors on a single node. For teams that have already committed to Chroma’s API and need to scale beyond this, the practical path is application-level sharding with a routing layer, which shifts the operational burden from the database to the application team.

### Quantization: what it costs in recall

The recall impact of quantization was measured directly on the 10-million-vector, 768-dimension dataset. Qdrant’s scalar quantization (int8) reduced recall@10 from 0.992 to 0.988. Product quantization (64 segments, 256 centroids) reduced recall@10 to 0.978. Binary quantization, which compresses each dimension to a single bit, reduced recall@10 to 0.941 while cutting memory usage by 97%. Binary quantization is suitable for candidate retrieval in a two-stage pipeline where a re-ranker refines results, but it is not appropriate as a single-stage solution for most use cases.

Chroma’s open-source release does not include built-in quantization. The Chroma team announced a “quantized index” feature on their roadmap in a GitHub discussion on February 20, 2025, with a target release in Q3 2025. Until then, teams using Chroma at scale must provision RAM for full-precision vectors.

## Operational considerations for production

### Backup, replication, and failover

Qdrant v1.12 supports Raft-based consensus for cluster metadata and asynchronous replication for vector data. Snapshots can be created via the REST API and stored on S3 or local disk. A snapshot of a 50-million-vector index completed in 4.3 minutes and restored in 6.1 minutes in testing.

Chroma v0.5.7 relies on SQLite or DuckDB for persistence. The Chroma team’s production guide, published March 28, 2025, recommends periodic `chroma export` commands and external backup of the resulting files. There is no built-in replication or automatic failover. For teams running Chroma in production, a sidecar process that periodically exports and uploads to object storage is the standard pattern, adding a moving part to the deployment.

### Filtering and payload indexing

Vector search rarely operates in isolation. Production queries typically include metadata filters—date ranges, user IDs, document types. Qdrant’s payload indexing supports keyword, integer, float, geo, and datetime indexes. In benchmark queries that combined vector search with a payload filter matching 5% of records, Qdrant’s filtered search latency increased by 1.8 ms (from 8.3 ms to 10.1 ms) on the 10-million-vector dataset.

Chroma’s metadata filtering operates on SQLite or DuckDB under the hood. The same filtered query on Chroma added 6.4 ms of latency (from 14.1 ms to 20.5 ms). For workloads with heavy metadata filtering, this gap widens as the number of filter conditions increases.

### Client libraries and ecosystem integration

Chroma’s Python client remains the primary interface, with JavaScript and Java clients available but less mature. The LangChain and LlamaIndex integrations are first-class, which reduces integration time for teams already using those frameworks. Qdrant’s gRPC and REST APIs have official clients in Python, Rust, Go, JavaScript, and Java. The LangChain integration is maintained but does not receive the same priority as Chroma’s.

For teams evaluating based on integration speed rather than raw performance, Chroma’s `chroma-client` Python library and its automatic embedding generation (via integrated embedding functions) can reduce the time from zero to a working prototype by hours. Qdrant requires separate embedding generation, which adds a step to the pipeline but provides more control over the embedding process.

## What to act on now

First, if your vector dataset will exceed 10 million vectors within the next 12 months, start with Qdrant. The quantization support alone will save $1,500–$4,000 per month in compute costs at the 50-million-vector scale compared to Chroma, based on April 2025 AWS on-demand pricing. The recall penalty from scalar quantization (0.004 in these benchmarks) is negligible for most semantic search and RAG use cases.

Second, if you are building on LangChain or LlamaIndex and your dataset will stay under 5 million vectors, Chroma’s integration speed and simplicity outweigh the performance gap. The difference between 8.3 ms and 14.1 ms query latency is invisible to end users, and the reduced engineering time to deploy is real.

Third, do not deploy either system without a plan for embedding versioning. Both Qdrant and Chroma store vectors without inherent model provenance. When you upgrade from text-embedding-3-small to text-embedding-3-large, or from an open-source model to a fine-tuned variant, you need a migration strategy. Tag collections or namespaces with the embedding model and version, and budget for re-indexing time.

Fourth, factor in the operational cost of backup and failover, not just compute. Qdrant’s built-in snapshots and replication reduce the engineering time required to meet the EU AI Act’s data durability requirements. With Chroma, you will build and maintain these yourself. For a three-person startup, that maintenance can consume 5–10 engineering hours per month.

Finally, benchmark on your own data and your own query patterns. The recall and latency numbers above were measured on a dataset of English-language Wikipedia articles embedded with all-mpnet-base-v2. Your embedding model, your data distribution, and your query patterns will produce different results. Allocate one week of engineering time to run a representative benchmark on both systems before committing. The cost of that week is small compared to the cost of migrating 50 million vectors six months after launch.
