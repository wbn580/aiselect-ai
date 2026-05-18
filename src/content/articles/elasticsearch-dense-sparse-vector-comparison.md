---
title: "Elasticsearch Dense vs Sparse Vector Comparison for E-commerce Search"
description: "The choice between dense and sparse vector embeddings in Elasticsearch has moved from an academic debate to a concrete engineering decision with measurable c…"
category: "Vector Databases"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:32:08Z"
modDatetime: "2026-05-18T08:32:08Z"
readingTime: 10
tags: ["Vector Databases"]
---

The choice between dense and sparse vector embeddings in Elasticsearch has moved from an academic debate to a concrete engineering decision with measurable cost and latency implications. As of October 2024, Elasticsearch 8.15 ships with production-ready support for both dense vectors via `dense_vector` fields and sparse vectors through the `sparse_vector` field type, including native integration with ELSER v2 and third-party models like SPLADE++.

The trigger for renewed scrutiny is straightforward: e-commerce search teams running Elasticsearch on AWS or GCP are seeing infrastructure bills climb as catalog sizes cross the 10-million-SKU threshold. A single `dense_vector` index with 768 dimensions at 10 million documents consumes approximately 30 GB of RAM for the HNSW graph alone, before accounting for inverted indices and stored fields. At the same time, retrieval quality benchmarks published by Elastic in August 2024 show that sparse vectors from ELSER v2 close the recall gap on short-tail queries to within 2–4 percentage points of dense embeddings from `all-MiniLM-L6-v2`, while requiring no GPU inference and roughly one-third the memory footprint.

This comparison examines the two approaches through the lens of a production e-commerce workload: faceted product search across a catalog of 5 million items, with query latency targets under 100 ms at p99 and a monthly infrastructure budget capped at US$5,000. The numbers that follow are drawn from Elastic’s own published benchmarks, third-party reproducibility tests, and pricing data current as of October 2024.

## Dense Vector Search in Elasticsearch

Dense embeddings map queries and documents into a fixed-length vector space, typically 384, 768, or 1,024 dimensions. In Elasticsearch, the `dense_vector` field type stores these as float arrays indexed via Hierarchical Navigable Small World (HNSW) graphs or, as of version 8.12, scalar-quantized int8 vectors that trade a small recall penalty for significant memory reduction.

### Memory Footprint and Indexing Cost

The storage math is unforgiving. A 768-dimensional float32 vector occupies 3,072 bytes per document. For a catalog of 5 million products, the raw vector data alone totals 15.36 GB. The HNSW index adds roughly 50–80% overhead depending on the `m` and `ef_construction` parameters, pushing total RAM for the vector index to between 23 GB and 28 GB. On an AWS `r6g.2xlarge` instance with 64 GB RAM at US$0.4032 per hour (US-east-1, on-demand pricing as of October 2024), that single index consumes roughly 40% of available memory before queries begin.

Quantization changes the calculus. With int8 scalar quantization introduced in Elasticsearch 8.12, the same 768-dimensional vector drops to 768 bytes per document, or 3.84 GB for 5 million vectors. The HNSW overhead remains, but the total vector index shrinks to approximately 8–10 GB. Elastic’s own benchmarks, published in the “Scalar Quantization in Lucene” blog post dated January 2024, measured a recall loss of 0.8–1.2% on the BEIR nfcorpus dataset when moving from float32 to int8 at equivalent HNSW parameters.

### Latency Characteristics

Dense vector search latency scales with the HNSW graph’s `ef_search` parameter and the number of segments in the underlying Lucene index. In benchmarks run by the Elastic search performance team and published on elastic.co on August 15, 2024, a single-shard deployment with 1 million 768-dimensional vectors returned approximate nearest neighbors in 12 ms at p50 and 38 ms at p99 when `ef_search` was set to 100. Scaling to 5 million vectors across 5 shards pushed p99 latency to 72 ms under the same configuration, measured on an `r6g.4xlarge` instance.

The critical variable for e-commerce is the kNN-to-faceted-search handoff. When a query requires both vector similarity and structured filtering (e.g., “red running shoes under US$100”), Elasticsearch executes the kNN phase first, then applies filters to the candidate set. If the kNN phase returns too few candidates that match the filters, recall collapses. The `num_candidates` parameter must be tuned upward, directly increasing latency. For a catalog with 200 distinct brand facets and 50 category facets, teams report setting `num_candidates` to 400–600 to maintain recall above 0.90 on filtered queries, pushing p99 latency past 100 ms.

### Model Inference Overhead

Dense embeddings require a transformer model at query time. Running `all-MiniLM-L6-v2` on CPU via Elastic’s Eland library adds 15–25 ms of inference latency per query on a single thread. GPU inference via an external service like Hugging Face Inference Endpoints drops that to 4–8 ms but introduces network round-trip variability and a separate billing line item. At US$0.06 per 1,000 tokens for the HF Endpoints CPU tier (October 2024 pricing), a search workload handling 500,000 queries per month with an average query length of 5 tokens incurs roughly US$150 per month in inference costs, excluding the Elasticsearch infrastructure itself.

## Sparse Vector Search with ELSER v2

Sparse vectors represent text as weighted term expansions rather than dense latent features. ELSER v2, Elastic’s proprietary sparse embedding model released in November 2023, outputs vectors where each dimension corresponds to a specific token in its vocabulary, with non-zero weights only for terms relevant to the input. A typical ELSER v2 vector for a 5-word query contains 40–80 non-zero dimensions out of a vocabulary of approximately 30,000.

### Storage and Memory Efficiency

The `sparse_vector` field type in Elasticsearch 8.15 stores only non-zero dimensions as a map of integer-to-float pairs. For a product catalog where title and description fields average 150 tokens, the ELSER v2 expansion produces roughly 120–200 non-zero dimensions per document. At 8 bytes per dimension (4-byte int key + 4-byte float value), each document consumes 960–1,600 bytes for its sparse vector, or 4.8–8.0 GB for 5 million documents. This represents a 3–5× reduction compared to float32 dense vectors and roughly parity with int8-quantized dense vectors.

The index structure itself is lighter. Sparse vectors in Lucene use a term-based posting list rather than an HNSW graph, meaning the index overhead scales with vocabulary size and term frequency rather than a fixed per-vector graph edge cost. Elastic’s documentation for version 8.15 notes that a `sparse_vector` field index typically adds 20–30% overhead to the raw vector data, compared to the 50–80% overhead of HNSW.

### Query Performance and Retrieval Quality

Sparse vector queries in Elasticsearch execute as modified term queries against the vector’s non-zero dimensions. There is no graph traversal, no `ef_search` tuning. Latency is dominated by the number of posting list intersections, which scales with the number of non-zero dimensions in the query vector. For ELSER v2, a typical query expansion contains 40–80 terms, resulting in p50 latency of 8–15 ms and p99 latency of 25–40 ms on a 5-million-document index, as measured in benchmarks published by Elastic on August 15, 2024.

The retrieval quality trade-off is query-dependent. On the BEIR benchmark’s NFCorpus dataset, ELSER v2 achieves NDCG@10 of 0.352, compared to 0.368 for `all-MiniLM-L6-v2` dense embeddings, a gap of 1.6 percentage points. On short-tail e-commerce queries (1–3 words), the gap widens to 3–5 points. On long-tail queries (5+ words), sparse and dense performance converge, with ELSER v2 occasionally outperforming dense embeddings by 1–2 points on queries containing rare product specifications like “EN 166:2001 certified safety goggles.”

### Model Deployment and Inference

ELSER v2 runs as a deployed model within Elasticsearch itself, using the built-in PyTorch inference pipeline. No external service is required. Inference latency for a 5-token query is 5–10 ms on CPU, measured on an `r6g.2xlarge` instance. For indexing, the model processes documents through the inference pipeline, adding roughly 2–3 ms of processing per 150-token document. At an indexing rate of 10,000 documents per second, this adds 20–30 seconds of processing per batch, which is material for large-scale reindexing but negligible for incremental updates.

The operational simplicity is the primary selling point. No GPU instances, no separate model-serving infrastructure, no network hops between query parsing and vector retrieval. For a team of 3–5 engineers managing a search deployment, this eliminates an entire failure domain.

## Hybrid Search: Combining Dense and Sparse

Elasticsearch 8.15 supports combining dense and sparse vector scores through the `reciprocal_rank_fusion` (RRF) query type, which merges result sets from multiple retrievers without requiring score normalization across different vector spaces. This is the approach recommended by Elastic for production e-commerce deployments as of their August 2024 search best-practices update.

### Reciprocal Rank Fusion Mechanics

RRF assigns a score to each document based on its rank position across multiple result sets: `score = Σ 1 / (k + rank)`, where `k` is a constant (default 60) that controls the influence of lower-ranked results. A document ranked 1st in dense search and 5th in sparse search receives a combined score of `1/(60+1) + 1/(60+5) = 0.0164 + 0.0154 = 0.0318`. The final ranking sorts by this combined score.

The advantage for e-commerce is that dense vectors handle semantic similarity (“running shoes” matching “athletic footwear”) while sparse vectors handle exact term matching (“Nike Air Zoom Pegasus 40” matching the specific model number). RRF merges these signals without requiring a labeled training set to learn combination weights, which is the approach used by learned fusion methods like those in Weaviate or Vespa.

### Measured Performance Impact

Elastic’s August 2024 benchmarks measured hybrid RRF search on a 1-million-document product catalog. Dense-only retrieval achieved NDCG@10 of 0.368. Sparse-only (ELSER v2) achieved 0.352. Hybrid RRF achieved 0.381, a 1.3-point improvement over dense-only and a 2.9-point improvement over sparse-only. The cost was latency: hybrid queries ran at 45 ms p99 compared to 38 ms for dense-only and 25 ms for sparse-only, measured on equivalent hardware.

The latency penalty comes from executing two independent retrieval phases and merging their results. For teams with a 100 ms p99 budget, the 45 ms hybrid latency leaves headroom for faceting, business logic, and network transit. For teams targeting 50 ms p99, hybrid search requires either reducing `num_candidates` (sacrificing recall) or moving to faster hardware.

## Cost Comparison for a 5-Million-Product Catalog

Infrastructure cost projections assume a single-region deployment on AWS `us-east-1` with on-demand pricing as of October 2024. The workload is 500,000 queries per month, 5 million documents, 768-dimensional dense vectors where applicable, and a target p99 latency under 100 ms.

### Dense-Only Deployment

A 3-node `r6g.2xlarge` cluster (64 GB RAM each, 192 GB total) provides sufficient memory for the vector index (28 GB), inverted index (15 GB), and OS overhead, with room for replication. At US$0.4032 per instance-hour, monthly compute cost is 3 × US$0.4032 × 730 = US$882.62. Adding 3 × 500 GB `gp3` volumes at US$0.08 per GB-month adds US$120.00. External inference via Hugging Face Endpoints at US$0.06 per 1,000 tokens for 500,000 queries averaging 5 tokens each adds US$150.00. Total: US$1,152.62 per month.

### Sparse-Only Deployment

A 2-node `r6g.2xlarge` cluster (128 GB total) handles the sparse vector index (8 GB), inverted index (15 GB), and ELSER v2 model memory (1 GB loaded per node). Monthly compute: 2 × US$0.4032 × 730 = US$588.67. Storage: 2 × 500 GB `gp3` = US$80.00. No external inference cost. Total: US$668.67 per month.

### Hybrid Deployment

A 3-node `r6g.2xlarge` cluster running both dense and sparse indices. The dense vector index consumes 28 GB, sparse vector index 8 GB, inverted index 15 GB, for a total of 51 GB of index data per primary shard. With one replica, total cluster memory requirement is approximately 102 GB, fitting within the 192 GB available. Monthly compute: US$882.62. Storage: US$120.00. Inference: US$150.00. Total: US$1,152.62 per month, identical to dense-only since the cluster sizing is driven by the dense vector index.

### Latency vs. Cost Trade-off

At 500,000 queries per month, the per-query cost difference between sparse-only and dense-only is approximately US$0.00097. For a high-volume e-commerce site handling 50 million queries per month, that gap widens to US$48,500 per month. The decision hinges on whether the 2.9 NDCG point improvement from hybrid search justifies the 72% cost premium over sparse-only, measured against the business metric that NDCG proxies: conversion rate, revenue per search session, or mean reciprocal rank of the first purchased item.

## Recommendations for Production E-commerce Search

Start with sparse-only retrieval using ELSER v2 if the catalog is under 10 million documents and the query mix is dominated by 3+ word searches. The US$668.67 monthly baseline leaves budget for relevance tuning and A/B testing infrastructure. Monitor NDCG@10 on a labeled evaluation set of at least 500 queries drawn from actual search logs, not synthetic examples. If NDCG falls below 0.30 on short-tail queries, add dense retrieval via RRF hybrid search and measure the incremental lift against the US$484 per month cost increase.

Quantize dense vectors to int8 before deploying to production. The 0.8–1.2% recall loss measured by Elastic in January 2024 is within the noise floor of most e-commerce relevance metrics, and the memory savings of roughly 60% allow smaller instance types or longer retention of vector indices in page cache.

Avoid building custom hybrid scoring models unless there is a dedicated search relevance engineer on the team. RRF with default `k=60` performs within 1 NDCG point of learned fusion on public benchmarks, and the operational overhead of training, deploying, and monitoring a custom fusion model exceeds the marginal relevance gain for all but the largest e-commerce operators. Elastic’s August 2024 guidance explicitly recommends RRF as the default hybrid strategy for teams without dedicated ML infrastructure.

Benchmark with production queries, not BEIR. The BEIR NFCorpus dataset contains 3.6K queries against 3.6K documents, a scale and distribution that does not reflect a 5-million-SKU e-commerce catalog with faceted navigation. Build an evaluation set from 90 days of anonymized search logs, stratified by query length, category, and conversion rate. Measure NDCG, recall@100, and p99 latency on this set before committing to a vector strategy.
