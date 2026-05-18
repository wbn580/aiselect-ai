---
title: "Qdrant Binary Quantization Recall Tradeoffs at Scale"
description: "When Qdrant shipped binary quantization (BQ) in v1.10.0 in August 2024, the vector database landscape shifted in a way that matters directly to anyone runnin…"
category: "Vector Databases"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:31:04Z"
modDatetime: "2026-05-18T08:31:04Z"
readingTime: 9
tags: ["Vector Databases"]
---

When Qdrant shipped binary quantization (BQ) in v1.10.0 in August 2024, the vector database landscape shifted in a way that matters directly to anyone running production RAG pipelines at scale. Memory costs for vector indexes have been climbing steadily as embedding dimensions push past 1,024 and collection sizes breach 100 million vectors. A single 1,536-dimensional float32 index with 50 million vectors consumes roughly 307 GB of RAM before any overhead. At AWS us-east-1 reserved instance pricing of $0.0156 per GB-hour for memory-optimized instances, that index alone costs $3,595 per month just to keep hot. Binary quantization promises to slash that memory footprint by up to 32x, dropping the same index to under 10 GB and the monthly RAM cost below $115. The catch—and it is a real catch—is recall degradation. Qdrant’s own benchmarks show BQ recall at 0.95–0.98 of full-precision search on standard ANN benchmarks, but those numbers come from controlled datasets. Production workloads with skewed distributions, high-dimensional outliers, or adversarial query patterns can see recall dip below 0.85. The decision to adopt BQ is not a checkbox; it is a tradeoff negotiation between infrastructure spend and retrieval accuracy that demands benchmarking against your actual data distribution, not vendor-published figures.

## How Binary Quantization Works in Qdrant

Binary quantization compresses each dimension of a float32 vector into a single bit. A vector that originally required 4 bytes per dimension now requires 0.125 bytes. The transformation is deceptively simple: dimensions with positive values become 1, negative values become 0. This is not product quantization, which partitions the vector space into subvectors and learns codebooks. It is not scalar quantization, which maps floats to int8 ranges. BQ is a sign-bit extraction with no learned parameters and no per-dimension calibration.

### The On-Disk and In-Memory Mechanics

Qdrant stores BQ vectors as bit-packed byte arrays. A 1,536-dimension vector occupies 192 bytes instead of 6,144 bytes. The HNSW graph structure remains unchanged—edges still reference the same node IDs—but the distance comparisons during search operate on the binary representation. Qdrant uses Hamming distance for BQ index traversal and can optionally perform a full-precision rescoring step on the top-k candidates. Rescoring retrieves the original float32 vectors from disk or a separate in-memory cache and recomputes exact cosine or Euclidean distances. This two-phase approach, documented in Qdrant’s v1.10.0 release notes (August 22, 2024), recovers most of the recall loss at the cost of additional latency and disk I/O.

### Oversampling as a Recall Lever

The primary knob for tuning BQ recall is the `oversampling` parameter. When set to 2.0, Qdrant retrieves twice as many candidates from the binary index before rescoring. At oversampling 3.0 on the DBPedia dataset (1M vectors, 1,536 dimensions, OpenAI text-embedding-3-large), Qdrant’s published benchmarks from September 2024 show recall@10 recovering from 0.91 to 0.97 relative to exact search, while query latency increases from 4.2 ms to 8.7 ms on an 8-core machine. The latency penalty is sublinear because HNSW graph traversal dominates, and the binary distance computation is CPU cache-friendly. But oversampling also increases the number of full-precision rescoring operations, which becomes the bottleneck at high throughput.

### Index Build Time and Storage Overhead

Building a BQ index is faster than building a full-precision HNSW index because distance computations during construction use the compressed representation. On a 10M-vector subset of LAION-5B with CLIP ViT-L/14 embeddings (768 dimensions), BQ index build time measured 22 minutes versus 47 minutes for the float32 equivalent on a single c6i.8xlarge instance, per independent testing published by the vector-db-benchmark project on GitHub (October 12, 2024). Storage on disk dropped from 30.7 GB to 2.1 GB. The tradeoff: the binary index alone cannot serve exact distance rankings, so applications that require precise nearest-neighbor ordering must either accept approximate results or pay the rescoring tax.

## Benchmarking Recall Degradation Across Datasets

Vendor benchmarks are a starting point, not a decision-making tool. Qdrant’s published BQ recall figures—0.95 to 0.98 on standard ANN benchmarks—use datasets with near-uniform cluster distributions and queries drawn from the same distribution as the indexed vectors. Production workloads rarely match these conditions.

### Standard Benchmark Results

On the ANN-Benchmarks glove-100-angular dataset (1.18M vectors, 100 dimensions), BQ with oversampling 2.0 and rescoring achieves recall@10 of 0.979 at 2,500 queries per second on a 32-core machine, per Qdrant’s v1.10.0 benchmark suite (August 2024). On the larger DEEP1B dataset (1B vectors, 96 dimensions), BQ recall@10 drops to 0.942 under the same configuration. The degradation on DEEP1B is attributable to the higher intrinsic dimensionality of the dataset: 96 dimensions with high variance across all axes means sign-bit extraction discards more information per dimension than on datasets where variance concentrates in a few principal components.

### Real-World Degradation Patterns

Independent testing by the RAG benchmarking group at Anyscale (published November 3, 2024) evaluated BQ on a proprietary 5M-document legal corpus indexed with voyage-law-2 embeddings (1,024 dimensions). Full-precision exact search recall@20 was 1.0 by definition. BQ with oversampling 1.5 and no rescoring achieved recall@20 of 0.86. With oversampling 3.0 and rescoring, recall recovered to 0.94. The gap between 0.94 and 1.0 translated to 6 missed relevant documents per 100 queries—unacceptable for legal discovery use cases where recall below 0.97 violates contractual SLAs. For a customer support chatbot indexing 2M Zendesk articles with text-embedding-3-small (512 dimensions), the same testing found BQ with oversampling 2.0 and rescoring at recall@10 of 0.96, which the team deemed acceptable given a 4x reduction in hosting costs from $1,240 to $310 per month.

### The High-Dimensional Penalty

Embedding models released in 2024 push dimensions higher. OpenAI’s text-embedding-3-large outputs 3,072-dimensional vectors in its maximum configuration. Voyage’s voyage-3-large produces 2,048 dimensions. Binary quantization on these vectors discards 31 bits of precision per dimension. On a synthetic benchmark with 1M random 3,072-dimensional vectors, BQ recall@10 without rescoring collapsed to 0.62, per a reproduction experiment published on the Qdrant community forum (December 8, 2024). The same vectors with PCA pre-processing to 768 dimensions before BQ recovered recall to 0.88. The implication: high-dimensional embeddings require dimensionality reduction before quantization, adding pipeline complexity and potential information loss at the reduction step.

## Cost-Performance Analysis at Production Scale

The decision to adopt BQ is ultimately a cost optimization problem. The savings are measurable and substantial; the recall cost is measurable and workload-dependent. What follows is a concrete cost model as of December 2024 pricing.

### Infrastructure Cost Comparison

Consider a production deployment indexing 50M vectors at 1,536 dimensions with a throughput requirement of 1,000 queries per second at p99 latency under 50 ms. The full-precision deployment requires 4x r7i.4xlarge instances (128 GB RAM each) to hold the index in memory with headroom for query processing. At on-demand pricing of $1.20 per hour per instance in us-east-1, monthly compute cost is $3,456. Add $480 for 2 TB of gp3 storage, and the total is $3,936 per month. The BQ deployment with oversampling 2.0 and rescoring requires 2x r7i.2xlarge instances (64 GB RAM each) because the compressed index fits in 10 GB and the rescoring cache holds the top-10% most-accessed full-precision vectors in 30 GB. Monthly compute drops to $864, storage to $180, total $1,044. Annual savings: $34,704.

### Latency Budget Breakdown

BQ search latency has two components: HNSW traversal on the binary index and rescoring on the candidate set. At oversampling 2.0 with top-100 candidate retrieval, traversal takes 3.1 ms on average, and rescoring 100 vectors at 1,536 dimensions takes 0.8 ms using AVX2-optimized dot product routines. Total latency is 3.9 ms, versus 5.2 ms for full-precision search on the same hardware. The BQ deployment is faster because the binary index fits entirely in L3 cache, reducing memory bandwidth pressure. At oversampling 4.0, traversal latency increases to 4.7 ms and rescoring to 1.6 ms, total 6.3 ms—slower than full-precision. The oversampling parameter creates a latency-recall Pareto frontier that must be tuned per workload.

### Throughput Scaling Characteristics

Binary quantization shifts the bottleneck from memory bandwidth to compute. On a 16-core machine, full-precision HNSW search saturates memory bandwidth at roughly 800 queries per second for a 1,536-dimension index that exceeds cache size. BQ on the same hardware reaches 3,200 queries per second before CPU saturation, per Qdrant’s v1.10.0 throughput benchmarks. This 4x throughput improvement means fewer instances for the same query volume, compounding the per-instance memory savings. For batch ingestion workloads, BQ indexes achieve 18,000 vector inserts per second versus 6,500 for full-precision on identical hardware, because graph construction distance computations are cheaper.

## When BQ Is the Wrong Choice

Binary quantization is not a universal optimization. Several workload characteristics make BQ unsuitable, and recognizing these before committing engineering time avoids costly rollbacks.

### Low-Dimensional Vectors

For vectors with fewer than 128 dimensions, the memory savings from BQ are proportionally smaller, and the recall penalty is proportionally larger because each dimension carries more information. On the ANN-Benchmarks sift-128-euclidean dataset (128 dimensions), BQ recall@10 with rescoring drops to 0.89, while memory savings are only 8x instead of the headline 32x. The cost-performance calculus shifts against quantization at low dimensionality.

### Strict Recall Requirements

Applications with contractual or regulatory recall requirements above 0.97 should not adopt BQ without extensive per-dataset validation. The Anyscale legal corpus benchmark showed BQ failing to meet a 0.97 recall threshold even with aggressive oversampling and rescoring. Hybrid search architectures that combine vector search with keyword-based BM25 retrieval can compensate for BQ’s recall gap, but this adds system complexity and a second retrieval path to maintain.

### Frequently Updated Indexes

BQ indexes support incremental updates, but each insert or delete requires recomputing the binary representation and potentially adjusting the HNSW graph edges. For workloads with high write amplification—more than 10,000 vector mutations per minute—the graph rebuild overhead erodes the ingestion throughput advantage. Qdrant’s WAL-based persistence model means BQ indexes must be periodically compacted, and compaction requires temporarily holding both the old and new index segments in memory, negating the memory savings during the compaction window.

## Actionable Takeaways

1. **Benchmark BQ on your actual data distribution before committing.** Qdrant’s published recall figures of 0.95–0.98 come from standard ANN benchmarks. Run a recall@k evaluation on a representative 100,000-vector sample of your production data with your actual query patterns. If recall drops below 0.90 at oversampling 2.0, BQ may not be viable without architectural changes like hybrid retrieval or dimensionality reduction.

2. **Tune oversampling per query pattern, not globally.** Queries with high specificity (rare entities, long-tail terms) benefit from oversampling 3.0–4.0. Queries with broad topical intent can operate at oversampling 1.5 with acceptable recall. Implement per-query oversampling logic based on query entropy or predicted difficulty, rather than setting a single value that over-provisions for easy queries and under-provisions for hard ones.

3. **Calculate the true cost savings including rescoring overhead.** The memory reduction from BQ is 32x in theory, but the rescoring cache, higher CPU utilization from oversampling, and compaction overhead reduce net savings. Model your specific workload: a 50M vector index at 1,536 dimensions saves roughly $2,892 per month at December 2024 AWS pricing after accounting for rescoring infrastructure, but a 10M vector index at 384 dimensions saves only $340 per month—potentially not worth the engineering effort to validate and maintain a quantized pipeline.

4. **Pair BQ with dimensionality reduction for embeddings above 2,048 dimensions.** The recall collapse observed on 3,072-dimensional random vectors (0.62 recall@10) makes BQ impractical for large embeddings without pre-processing. PCA to 768 or 1,024 dimensions before quantization recovers recall to usable ranges, but the PCA transform itself introduces latency and must be retrained as the data distribution shifts.

5. **Monitor recall drift in production.** Data distributions change. Queries that worked at 0.96 recall in October may degrade to 0.91 by February as new document clusters enter the index. Implement a recall monitoring pipeline that samples production queries, runs them against both the BQ index and a full-precision baseline (even if the baseline is a small random subset of the full index), and alerts when the recall gap widens beyond an acceptable threshold. Without monitoring, BQ’s cost savings can silently convert into user-facing quality regressions.
