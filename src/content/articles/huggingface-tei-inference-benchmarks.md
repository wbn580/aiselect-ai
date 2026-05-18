---
title: "Hugging Face TEI Inference Benchmarks for Embedding Generation"
description: "As organizations push embedding-based retrieval into production at scale, the economics of inference have shifted from a background concern to a line-item th…"
category: "Dev Frameworks"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:51:50Z"
modDatetime: "2026-05-18T08:51:50Z"
readingTime: 8
tags: ["Dev Frameworks"]
---

As organizations push embedding-based retrieval into production at scale, the economics of inference have shifted from a background concern to a line-item that directly shapes architecture decisions. Through 2024 and into early 2025, the cost of generating embeddings on GPU-backed cloud instances has remained stubbornly high—an on-demand p4d.xlarge on AWS still runs $3.28 per hour as of February 2025, while dedicated embedding APIs from major providers bill per 1,000 tokens at rates that compound quickly when indexing millions of documents. At the same time, the open-weight model ecosystem has matured to the point where models like `intfloat/e5-mistral-7b-instruct` and `BAAI/bge-large-en-v1.5` deliver retrieval quality within striking distance of proprietary alternatives. The missing piece has been a serving layer that extracts maximum throughput from modest hardware without demanding that every team become CUDA kernel specialists. Hugging Face’s Text Embeddings Inference (TEI) project, first released in mid-2023 and iterated steadily through version 1.5 in October 2024, aims to fill exactly that gap. It is not a model, not a vector database, and not a managed service—it is a purpose-built inference server optimized for embedding and reranking workloads, and its benchmark profile deserves a close look from anyone signing cloud bills for RAG pipelines.

## Throughput and Latency at Realistic Batch Sizes

Embedding workloads differ from chat completions in a way that makes benchmarking methodology particularly important. A developer integrating an LLM API typically cares about time-to-first-token and end-to-end latency for a single prompt. An embedding pipeline, by contrast, almost always processes documents in batches—hundreds of chunks from a single PDF, thousands of product descriptions for an e-commerce catalog rebuild, or millions of web pages during a periodic re-index. Raw throughput at batch sizes between 8 and 256 is the metric that translates directly to wall-clock time and cost.

### Single-GPU Throughput on A100 and A10G Hardware

Hugging Face published a TEI performance benchmark on October 17, 2024, using `BAAI/bge-large-en-v1.5`—a 335-million-parameter model that produces 1,024-dimensional embeddings—running on an NVIDIA A100 80 GB GPU. At a batch size of 256, TEI 1.5 delivered 9,200 sequences per second with token pooling enabled. On the smaller A10G instance type (commonly found in `g5.4xlarge` spots on AWS at $1.624 per hour on-demand as of February 2025), the same model and batch size yielded 3,800 sequences per second. For a concrete workload: indexing 10 million 512-token passages on a single A100 would take approximately 18 minutes of inference time, while the A10G would require roughly 44 minutes. The difference in cloud cost between those two runs—about $1.00 on the A100 spot market versus $1.19 on the A10G—is small enough that the hardware choice hinges more on availability and memory headroom than on raw price.

### Scaling Behavior Across Concurrent Requests

The TEI server uses an internal dynamic batching mechanism that coalesces concurrent requests into larger GPU batches without requiring the client to manage grouping logic. Benchmarks from a community reproducibility run posted to the Hugging Face Discord on January 12, 2025 showed that with 16 concurrent clients each sending batches of 32 sequences, TEI 1.5 on an A100 sustained 7,100 sequences per second—a drop of only 23% from the single-client batch-of-256 number. This near-linear scaling at moderate concurrency levels means that TEI fits naturally behind a load-balanced HTTP endpoint without introducing a separate batching proxy layer, a simplification that removes an entire class of operational headaches in production.

## Token Pooling and Precision Tradeoffs

One of TEI’s distinguishing architectural choices is its native support for token-level pooling strategies that go beyond the standard CLS-token extraction baked into many BERT-family serving setups. For retrieval use cases, the difference between mean pooling and CLS pooling can shift benchmark recall@10 by 2–5 percentage points depending on the model and dataset, a gap that is large enough to matter in high-recall applications like legal document retrieval or medical literature search.

### Mean Pooling vs. CLS Token Performance

Using the MTEB retrieval benchmark subset as a reference point, `BAAI/bge-large-en-v1.5` with mean pooling achieves a normalized NDCG@10 of 73.2 on the SCIDOCS dataset, compared to 70.8 with CLS pooling—a 2.4-point gap confirmed in a January 2025 independent evaluation by the MTEB maintainers. TEI exposes pooling as a server-side configuration flag (`--pooling mean` or `--pooling cls`), which means the pooling strategy can be set at deployment time without modifying the model weights or the client code. For teams that fine-tune their own embedding models, this configurability removes one variable during A/B testing: the same TEI instance can serve mean-pooled embeddings for one experiment and CLS-pooled embeddings for another by changing a single startup parameter.

### FP16 vs. INT8 Quantization Impact

TEI 1.5 added support for INT8 weight-only quantization via the `bitsandbytes` backend, allowing a model like `intfloat/e5-mistral-7b-instruct`—which normally requires roughly 14 GB of VRAM in FP16—to fit into approximately 8 GB. The throughput tradeoff is measurable. On an A10G with 24 GB VRAM, the FP16 version of `e5-mistral-7b-instruct` processed 1,450 sequences per second at batch size 64 in Hugging Face’s October 2024 benchmarks. The INT8 quantized variant on the same hardware reached 2,100 sequences per second—a 45% throughput increase—while MTEB retrieval scores dropped by an average of 0.8 percentage points across 8 datasets. Whether that 0.8-point degradation is acceptable depends on the application; for a customer-facing semantic search bar where the top-3 results matter most, the tradeoff is often favorable. For a legal discovery pipeline where recall@100 is the key metric, FP16 may be worth the extra VRAM.

## Reranking Model Inference Under Load

TEI supports reranking models—cross-encoders that score query-document pairs directly—alongside its embedding functionality. This dual capability means a single TEI deployment can handle both the initial embedding-based retrieval and the subsequent refinement pass, reducing the number of distinct services in a RAG architecture.

### Cross-Encoder Throughput on Consumer Hardware

The `BAAI/bge-reranker-large` model, a 560-million-parameter cross-encoder, is a common choice for reranking top-100 candidate sets. On an NVIDIA RTX 4090 (a consumer GPU with 24 GB VRAM, approximately $1,800 retail as of February 2025), TEI 1.5 processed 1,200 query-document pairs per second at batch size 64, according to community benchmarks shared on the Hugging Face forums on December 3, 2024. For a typical RAG pipeline that retrieves 100 candidates per query and reranks all of them, this translates to roughly 12 queries per second on a single consumer GPU—enough to serve dozens of concurrent users with sub-200ms reranking latency, assuming the embedding retrieval step is handled separately.

### Memory Footprint and Multi-Model Deployments

A practical consideration for teams running both embedding and reranking models is whether they can coexist on a single GPU without memory pressure. TEI does not natively support multi-model serving within a single process, but running two TEI containers on the same GPU—one for embeddings, one for reranking—is feasible if the combined model weights fit within VRAM. On a 48 GB A40, `BAAI/bge-large-en-v1.5` (1.3 GB in FP16) and `BAAI/bge-reranker-large` (2.2 GB in FP16) leave ample room for KV caches and batch overhead. Community testing from November 2024 showed stable co-location with no throughput degradation when total VRAM utilization stayed below 80%, a threshold that aligns with NVIDIA’s own guidance on avoiding memory fragmentation under CUDA’s unified memory model.

## Deployment Footprint and Operational Overhead

TEI is distributed as a Docker image (`ghcr.io/huggingface/text-embeddings-inference`) with version tags pinned to specific releases—`1.5.0` being the latest stable tag as of this writing. The image size is approximately 3.2 GB uncompressed, which is lean enough for rapid cold starts on container orchestration platforms. Startup time on an A10G instance, including model weight download from the Hugging Face Hub, averages 45 seconds for `bge-large-en-v1.5` and 2 minutes 10 seconds for `e5-mistral-7b-instruct`, based on timings recorded by a DevOps engineer and posted to the TEI GitHub Discussions on January 20, 2025.

### gRPC vs. HTTP Transport

TEI exposes both a REST API (documented at `/docs` on the running server) and a gRPC endpoint. The gRPC interface uses protocol buffers and supports streaming, which becomes relevant for very large batches where the serialization overhead of JSON becomes non-trivial. In a benchmark run by a contributor on January 28, 2025 comparing the two transports with `bge-large-en-v1.5` at batch size 256, gRPC delivered 9,450 sequences per second versus 9,200 over HTTP—a 2.7% improvement. For most deployments, this gap is negligible, and the simplicity of HTTP-based load balancing and health checking outweighs the marginal throughput gain. Teams that already operate a gRPC service mesh may prefer the native integration.

### Monitoring and Observability

TEI emits Prometheus metrics on port 9090, including `tei_request_duration_seconds`, `tei_queue_size`, and `tei_batch_size`. These three metrics alone provide enough signal to set up alerting for latency degradation and throughput anomalies. The queue size metric is particularly useful: a sustained queue depth above 2× the configured max batch size indicates that the server is falling behind incoming request volume, which can trigger either horizontal scaling or a reduction in client-side batch sizes to smooth out load spikes.

## What the Numbers Mean for Buyers

The benchmark data points to a clear set of decision rules for teams evaluating TEI against alternatives like Infinity, FastEmbed, or managed embedding APIs. First, if your workload involves batch sizes of 32 or larger and you control the hardware, TEI’s dynamic batching and token pooling configurability provide throughput that is difficult to replicate with a generic FastAPI wrapper around SentenceTransformers. The 9,200 sequences-per-second figure on an A100 translates to roughly $0.00004 per 1,000 embeddings at spot pricing—two orders of magnitude below the $0.02–$0.05 per 1,000 tokens charged by managed embedding APIs as of February 2025.

Second, the INT8 quantization path is production-ready for use cases where a sub-1% retrieval quality drop is acceptable, and it unlocks meaningful cost savings by fitting 7-billion-parameter embedding models onto GPUs that would otherwise be undersized. Third, the reranking capability eliminates the need for a separate cross-encoder service, but teams should measure whether co-locating embedding and reranking workloads on a single GPU introduces tail latency under peak load before committing to that architecture. Fourth, TEI’s operational surface area—Docker container, Prometheus metrics, HTTP health checks—is small enough that a single engineer can own the deployment in a week, but the project’s release cadence (roughly quarterly) means that pinning to a specific version tag and testing upgrades in staging is non-negotiable. Finally, the gap between HTTP and gRPC throughput is small enough that teams should default to HTTP unless they are already invested in gRPC infrastructure; the operational simplicity is worth the 2.7% throughput difference.
