---
title: "pgvector vs Specialized Vector DBs: When PostgreSQL Works for RAG and When It Doesn't"
description: "The tension between general-purpose databases and purpose-built vector stores has moved from architecture whiteboards into production incident logs. In Febru…"
category: "Vector DBs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:23:52Z"
modDatetime: "2026-05-18T08:23:52Z"
readingTime: 10
tags: ["Vector DBs"]
---

The tension between general-purpose databases and purpose-built vector stores has moved from architecture whiteboards into production incident logs. In February 2025, Supabase disclosed that its pgvector-backed vector search workloads crossed 1.2 billion monthly queries across managed instances, up from 480 million in August 2024 — a 150% increase in six months driven largely by RAG pipelines that outgrew their embedding budgets but not their Postgres clusters. That same month, a Y Combinator-backed legal-tech startup publicly detailed a 72-hour outage caused by a specialized vector database hitting an undocumented index size ceiling at 1.8 million document chunks, forcing an emergency migration to pgvector on an existing Aurora PostgreSQL instance. The migration completed in 11 hours and added $2,140 to their monthly AWS bill, compared to the $1,870 they had been paying for the dedicated vector DB. The trade-off was no longer theoretical.

The question is not whether PostgreSQL can do vector search. It can, and the pgvector 0.7.0 release (December 2024) closed significant gaps in recall and throughput that previously made the answer an easy “no” above a few hundred thousand vectors. The question is under what conditions the operational simplicity of staying on Postgres outweighs the query-per-second-per-dollar advantage that specialized systems still hold at scale. This article evaluates that line with current benchmarks, dated pricing, and explicit failure modes observed in production deployments through March 2025.

## Where pgvector Closes the Gap

PostgreSQL extensions have a history of absorbing niche database categories — PostGIS for spatial, TimescaleDB for time-series, Citus for distributed — and pgvector is following the same trajectory, albeit with sharper performance constraints at the upper bound.

### Recall Quality After 0.7.0

Prior to pgvector 0.7.0, the extension used IVFFlat indexing exclusively, which trades recall for speed and becomes unreliable above roughly 500,000 vectors at 1,536 dimensions (OpenAI text-embedding-ada-002). The 0.7.0 release added HNSW indexing with configurable ef_construction and ef_search parameters. In benchmarks published by Neon on January 15, 2025, pgvector 0.7.0 with HNSW achieved 0.987 recall@10 on the ANN-Benchmarks sift-128-euclidean dataset at 1 million vectors, compared to 0.992 for Qdrant 1.12 and 0.990 for Weaviate 1.26. The gap narrowed to within 0.5 percentage points — functionally indistinguishable for most RAG use cases where the LLM re-ranks results anyway.

The more instructive benchmark came from a LangChain evaluation suite run by a European insurance firm and shared in a February 6, 2025 blog post. On their internal 2.1-million-document corpus using the multilingual-e5-large embedding model (1,024 dimensions), pgvector 0.7.0 with HNSW scored 0.941 recall@20 versus 0.958 for a Pinecone p2.x1 index. The 1.7 percentage point gap translated to a 3.2% difference in downstream answer accuracy when using gpt-4o-2024-08-06 as the generation model, measured by human evaluators on 500 queries. The firm’s engineering lead noted that changing the chunking strategy from 512-token fixed windows to 256-token with 64-token overlap improved pgvector’s effective recall more than switching databases would have — a reminder that retrieval quality is dominated by preprocessing, not index architecture, until extreme scale.

### Operational Simplicity as a Feature

A RAG system already requires an embedding service, an LLM endpoint, a chunking pipeline, and a reranker. Adding a separate vector database introduces a fifth stateful service with its own backup regime, auth layer, upgrade cycle, and client library versioning. For teams running PostgreSQL as their primary store, pgvector collapses two databases into one.

A survey of 340 engineering teams published by Vercel’s AI advisory group on March 3, 2025 found that 62% of teams building their first production RAG system chose pgvector, up from 41% in a similar survey conducted in June 2024. The primary reason cited was “already running Postgres” (78% of pgvector adopters), followed by “fewer moving parts” (54%). Performance was the third most common factor at 31%, suggesting that for initial deployments, architectural simplicity dominates raw throughput considerations.

The cost story is similarly straightforward. A db.r6g.xlarge Aurora PostgreSQL instance with 4 vCPUs and 32 GB RAM costs $0.58 per hour ($425 monthly) in us-east-1 as of March 2025 pricing. Adding pgvector to an existing instance costs nothing beyond the storage for the vector index itself — roughly 1.2 GB per 100,000 vectors at 1,536 dimensions with HNSW. A dedicated Qdrant Cloud cluster with comparable memory starts at $0.87 per hour ($635 monthly). Pinecone’s p2.x1 index costs $0.96 per hour ($700 monthly) for up to 1 million vectors. The delta of $210–$275 per month is modest in absolute terms but represents a 49–65% increase over the marginal cost of pgvector on existing infrastructure.

## When Specialized Vector DBs Pull Away

The operational argument for pgvector weakens as query volume and latency sensitivity increase. Specialized vector databases are built for one workload, and that focus shows in throughput, filtering performance, and multi-tenancy.

### Throughput at 100+ QPS

The ANN-Benchmarks suite measures recall against queries per second, and the divergence becomes pronounced above 100 QPS. On the glove-100-angular dataset at 1.18 million vectors, pgvector 0.7.0 with HNSW (ef_search=40) delivered 187 QPS at 0.985 recall on a c6g.8xlarge EC2 instance (32 vCPUs, 64 GB RAM), per benchmarks published by the pgvector maintainers on December 18, 2024. Qdrant 1.12 on the same hardware reached 1,240 QPS at equivalent recall — a 6.6x throughput advantage. Milvus 2.4.0 reached 2,100 QPS.

The gap widens under concurrent load. A benchmark from Timescale’s engineering team, published February 20, 2025, tested 16 concurrent clients issuing nearest-neighbor queries against 2 million 1,536-dimensional vectors. pgvector 0.7.0 on a 16 vCPU PostgreSQL 16 instance sustained 340 QPS at p99 latency of 480 ms. Qdrant 1.12 on equivalent hardware sustained 2,900 QPS at p99 latency of 42 ms. The pgvector p99 latency exceeded 1 second at 500 QPS offered load, while Qdrant stayed under 100 ms through 3,000 QPS.

For a RAG application serving 10 concurrent users, a 480 ms p99 latency is acceptable — the LLM generation step typically takes 2–5 seconds anyway. For a customer-facing semantic search with a 200 ms SLA serving 500 concurrent users, pgvector on a single node will not meet the bar without aggressive caching or read replicas.

### Filtered Vector Search

Many production RAG pipelines combine vector similarity with metadata filters — date ranges, user permissions, document status — and this is where pgvector’s Postgres foundation becomes a liability rather than an asset. PostgreSQL’s query planner must decide whether to apply the metadata filter first and then perform vector search, or perform vector search and then filter. Both paths have failure modes.

When the metadata filter is selective (returning, say, 0.1% of rows), applying it first and running HNSW on the filtered set is efficient. When the filter is broad (50% of rows), the planner often chooses a sequential scan with vector distance computation, which collapses throughput. A detailed analysis by a Pinecone engineer published on March 10, 2025 demonstrated that pgvector 0.7.0 filtered search throughput varied by a factor of 40x depending on filter selectivity, while Qdrant’s payload indexing kept throughput within a 2x band across the same selectivity range. Milvus and Weaviate showed similar stability due to their native hybrid query engines that co-locate vector and scalar indexes.

For multi-tenant RAG systems where each query is scoped to a single customer’s document set, this variability is problematic. A query against a tenant with 50,000 documents completes in 30 ms; a query against a tenant with 50 documents on the same cluster can take 400 ms because the planner chooses a different strategy. Specialized vector databases handle this pattern through partition-level indexing that pgvector does not yet support natively.

### Disk-Resident Workloads

pgvector requires the HNSW index to fit in shared buffers for competitive performance. When the index spills to disk, latency degrades by 10–50x. At 1,536 dimensions, a 10-million-vector HNSW index occupies roughly 60 GB. Keeping that in memory requires a PostgreSQL instance with at least 64 GB of RAM, which at AWS on-demand pricing (db.r6g.4xlarge) costs $2.32 per hour ($1,694 monthly). At 100 million vectors, the index approaches 600 GB, requiring a db.r6g.16xlarge at $9.28 per hour ($6,774 monthly).

Specialized vector databases use memory-mapped storage and segment-based indexing to serve billion-scale indexes from disk with modest RAM requirements. Milvus 2.4.0 with DiskANN can serve a 100-million-vector index from a cluster of three c6g.2xlarge instances ($0.34 per hour each, $744 monthly total) at sub-100 ms p99 latency. Qdrant’s quantization features in version 1.12 reduce memory footprint by up to 90% through scalar and product quantization, with a 1–3% recall penalty. For billion-scale deployments, the cost differential is not incremental — it is a 5–10x multiple.

## The Hybrid Pattern That Is Gaining Traction

Rather than choosing one system, a growing number of production architectures use pgvector as the source-of-truth vector store and a specialized database as a read-optimized cache. This pattern appeared in at least three publicly documented deployments in Q1 2025.

A San Francisco-based code search startup described their architecture in a February 28, 2025 engineering blog post: PostgreSQL stores all 12 million code chunk embeddings alongside the source repositories, with pgvector providing point-in-time retrieval for audit and backfill. A Qdrant cluster with 8 million vectors in memory serves all user-facing search traffic with a 50 ms p95 latency target. A Debezium CDC pipeline streams inserts and updates from PostgreSQL to Qdrant with sub-second lag. When Qdrant is unavailable, the application falls back to pgvector with degraded but functional performance. The total infrastructure cost is $3,200 per month — $1,100 for the Aurora instance and $2,100 for the Qdrant cluster — which the team considers acceptable for the latency and availability guarantees.

This pattern inverts the “start with pgvector, migrate later” narrative. It treats pgvector as the durable, transactional store and the specialized database as the performance layer. The approach requires engineering investment in CDC and fallback logic but avoids the data synchronization headaches that occur when the vector database is the primary store and drift develops between embeddings and source documents.

## Model-Specific Considerations for 2025

Embedding model choices interact with database selection in ways that are easy to overlook during evaluation. The January 2025 release of OpenAI’s text-embedding-3-large (3,072 dimensions) and the continued popularity of Cohere’s embed-v4.0 (also 3,072 dimensions) have increased the dimensional load on vector indexes by 2x compared to the previous generation of 1,536-dimension models. Higher dimensionality increases index size linearly and query latency superlinearly for exact search, though HNSW scales roughly logarithmically with dimension count.

A benchmark by Cohere’s applied research team, published March 5, 2025, found that reducing text-embedding-3-large embeddings to 1,024 dimensions via Matryoshka representation learning — a technique supported natively by the model — decreased index size by 66% with a 0.8% recall@10 degradation on the BEIR benchmark suite. Teams using pgvector for high-dimensional embeddings should evaluate Matryoshka truncation before scaling hardware; the recall trade-off is often smaller than the latency improvement.

Claude 3.5 Sonnet (claude-3.5-sonnet-20241022) has also shifted the retrieval calculus. Its 200,000-token context window means some RAG architectures are moving from “retrieve top-10 chunks” to “retrieve top-40 chunks and let the model sort it out.” This places higher throughput demand on the vector store — four times as many vectors retrieved per query — which favors specialized databases with higher QPS capacity. A RAG system that retrieves 40 chunks of 512 tokens each consumes roughly 20,000 tokens of context, leaving 180,000 tokens for the prompt and generated response. The retrieval step becomes the throughput bottleneck before the LLM step does.

## Takeaways

**Benchmark your actual workload before committing.** The recall gap between pgvector 0.7.0 and specialized databases is under 2% on standard benchmarks, but throughput at 100+ QPS diverges by 6–10x. If your application expects fewer than 50 QPS and can tolerate p99 latencies above 200 ms, pgvector is operationally simpler and cheaper. If you are building a customer-facing search experience with a latency SLA, run a load test with your own embedding model and query pattern before defaulting to Postgres.

**Filtered search is the real differentiator, not raw vector recall.** Most production RAG systems require metadata filtering, and pgvector’s performance variance of 40x across filter selectivity ranges is a more significant operational risk than the 1–2% recall gap. If your application requires permission-scoped or date-range-filtered vector search, evaluate Qdrant, Milvus, or Weaviate specifically on filtered query benchmarks.

**The CDC-backed hybrid pattern is underrated.** Using pgvector as the durable store with a specialized vector database as a read cache provides the best of both architectures: transactional consistency from Postgres, query performance from the specialized system, and a built-in fallback. The engineering cost of CDC setup is non-trivial but lower than an emergency migration.

**Dimension management reduces cost more than database selection.** Matryoshka embedding truncation from 3,072 to 1,024 dimensions reduces index size by 66% with minimal recall impact. This optimization applies regardless of database choice and often yields larger cost savings than switching between pgvector and a specialized alternative for deployments under 10 million vectors.

**Plan for the model, not just the database.** The shift toward long-context models like Claude 3.5 Sonnet (claude-3.5-sonnet-20241022) and Gemini 2.0 Flash means retrieval pipelines will fetch more chunks per query. A vector store that handles 100 QPS at top-10 retrieval may struggle at top-40. Provision for the retrieval pattern your generation model enables, not the one your current prompt template uses.
