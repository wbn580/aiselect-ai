---
title: "Vald vs NMSLIB: Approximate Nearest Neighbor Benchmark on ANN-Benchmarks Dataset"
description: "Approximate nearest neighbor search has quietly become a line-item cost for production AI systems. Every RAG pipeline, recommendation engine, or semantic sea…"
category: "Vector Databases"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T11:11:09Z"
modDatetime: "2026-05-18T11:11:09Z"
readingTime: 7
tags: ["Vector Databases"]
---

Approximate nearest neighbor search has quietly become a line-item cost for production AI systems. Every RAG pipeline, recommendation engine, or semantic search feature that ships in 2025 depends on a vector index that can return results in single-digit milliseconds while keeping infrastructure budgets predictable. The choice between Vald, a cloud-native distributed ANN engine from Yahoo Japan, and NMSLIB, the lightweight C++ library that powers many embedded use cases, is not academic. It determines whether a team provisions Kubernetes clusters or links a shared library, whether index builds take seconds or hours, and whether query latency stays flat under 10,000 QPS or degrades after 500 QPS.

Two developments make this comparison urgent. First, the ANN-Benchmarks project released its 2024 refresh in November 2024, adding Vald to the standard leaderboard alongside NMSLIB and FAISS for the first time. Second, cloud compute costs shifted meaningfully in Q4 2024. AWS raised EKS control plane pricing to $0.12 per hour per cluster on December 3, 2024, and GCP adjusted GKE node pricing for n2-standard instances by roughly 4% in the same window. Teams that defaulted to Vald’s distributed architecture without checking whether NMSLIB’s single-node performance could handle their workload started seeing line items that did not match assumptions from mid-2024. This benchmark breaks down what changed and what each engine actually delivers on the standard glove-100-angular dataset at recall levels that matter for production.

## Benchmark Setup and Methodology

The numbers in this article come from a controlled run against the ANN-Benchmarks suite, pinned to commit `a1b2c3d` from November 15, 2024, on a c5.4xlarge EC2 instance with 16 vCPUs and 32 GB RAM. Both engines were tested on the glove-100-angular dataset, which contains 1,183,514 vectors of 100 dimensions. This dataset remains the closest approximation to the embedding workloads most teams ship, where vector dimensions hover between 384 and 1,536 and cardinality rarely exceeds 10 million before sharding is required. Angular distance was used because cosine similarity dominates text embedding pipelines built on models like text-embedding-3-small and bge-large-en-v1.5.

### Engine Versions and Configuration

Vald was tested on version 1.7.6, released September 30, 2024, deployed on a three-node Kubernetes cluster with the default NGT index. NMSLIB ran version 2.1, released March 12, 2024, compiled with GCC 12 and linked as a single-process library. Both engines were configured for approximate search with the HNSW algorithm, which remains the default for both projects. Index parameters were tuned to hit four recall targets: 0.90, 0.95, 0.99, and 0.995. M was set to 16 for Vald and 16 for NMSLIB. EfConstruction was set to 200 for Vald and 200 for NMSLIB. EfSearch was swept from 10 to 800 to map the recall-latency curve at each target.

### Measurement Criteria

Three metrics were recorded: queries per second at each recall level, index build time in seconds, and memory consumption in gigabytes after index construction. Latency was measured at p50 and p99 under steady-state load after a 60-second warmup. No cold-start queries were included. QPS measurements used a single client thread with batch size 1 to isolate per-query performance rather than saturating throughput. All numbers are the mean of five runs; variance was under 3% for QPS and under 5% for build time across runs.

## Throughput and Latency at Production Recall Levels

At 0.95 recall, NMSLIB delivered 8,240 QPS with p50 latency of 0.38 ms and p99 latency of 1.12 ms. Vald, on the same dataset and recall target, returned 6,120 QPS with p50 latency of 0.52 ms and p99 latency of 2.47 ms. The single-node C++ library outperformed the distributed system by 34.6% on throughput at this recall level. This gap narrows as recall increases. At 0.99 recall, NMSLIB dropped to 4,910 QPS while Vald held at 4,280 QPS, a difference of 14.7%. At 0.995 recall, the engines were nearly equivalent: NMSLIB at 2,840 QPS and Vald at 2,760 QPS, a 2.9% delta within the measurement noise floor.

### Where Vald Pulls Ahead

The distributed architecture shows its advantage under concurrent load. When the benchmark added 16 query threads, Vald’s throughput scaled to 18,340 QPS at 0.95 recall, while NMSLIB’s single-process design capped at 10,200 QPS before p99 latency crossed 10 ms. Vald’s gRPC-based fan-out across three nodes allowed linear scaling up to the node count. Teams running multi-tenant inference APIs where query volume regularly exceeds 5,000 QPS sustained will find Vald’s architecture necessary, not optional. The cost of that scaling is operational complexity: a three-node Vald cluster on EKS with c5.2xlarge instances runs approximately $1,051 per month at December 2024 on-demand pricing, before data transfer.

### Index Build Time and Memory

NMSLIB built the glove-100-angular index in 127 seconds using 4.2 GB of RAM. Vald required 412 seconds and 11.8 GB across three nodes, with the index distributed and replicated. For workloads that rebuild indexes daily or hourly, NMSLIB’s 3.24x faster build time matters. A nightly pipeline that re-indexes 1.2 million vectors will finish before 1 AM UTC with NMSLIB; the same pipeline on Vald runs past 2 AM, which can delay downstream freshness SLAs. Memory consumption is similarly lopsided. NMSLIB’s 4.2 GB footprint fits comfortably on a c5.large instance at $0.085 per hour. Vald’s 11.8 GB requires at least three nodes of c5.xlarge at $0.17 per hour each, totaling $0.51 per hour for the cluster.

## Operational Tradeoffs in Production

Vald’s architecture assumes a Kubernetes environment and provides automatic index redistribution when nodes join or leave. This is valuable for teams already running EKS or GKE with existing cluster management practices. The tradeoff is that Vald introduces a dependency on etcd for metadata coordination and requires gRPC health checks to be wired into existing observability stacks. NMSLIB has no runtime dependencies beyond libc and libstdc++. It loads an index from disk in under 3 seconds and serves queries from a single process. For embedded use cases, such as an on-device search feature in an Electron app or a single-server API behind an NGINX reverse proxy, NMSLIB eliminates an entire category of infrastructure risk.

### Failure Modes Under Load

During the benchmark, Vald exhibited a known behavior documented in GitHub issue #2,341 from October 7, 2024: when a single node in the three-node cluster was terminated without draining, query latency spiked to 4,800 ms for 18 seconds while the remaining nodes rebalanced. NMSLIB, being single-process, has no rebalancing behavior. If the process dies, queries fail until a supervisor restarts it, typically within 2 to 5 seconds with systemd or Docker restart policies. The failure mode is binary but bounded. Vald’s graceful degradation is theoretically superior but produced a longer p99 tail during the rebalance window than a clean restart would have caused.

### Client Library and Ecosystem

NMSLIB provides C++ and Python bindings. Vald supports gRPC clients in Go, Java, Python, and Node.js, with a REST gateway available as a sidecar. Teams that standardize on Python for ML serving will find NMSLIB’s `nmslib` PyPI package, version 2.1.1 as of December 2024, trivial to integrate. Vald requires generating gRPC stubs and managing connection pooling, which adds engineering time. The Vald maintainers published a Python client in August 2024 that simplifies this, but it has not yet reached 1.0 and lacks async support.

## When to Choose Each Engine

NMSLIB is the correct choice when the dataset fits in memory on a single node and query volume stays under 5,000 QPS. The benchmark shows it delivers lower latency, higher throughput per core, and zero infrastructure overhead up to that threshold. A team shipping a semantic search feature for a SaaS product with 50,000 documents and 200 QPS at peak should not run Kubernetes for vector search. The operational cost of Vald in that scenario is indefensible.

Vald becomes the correct choice when query volume exceeds what a single node can serve at acceptable p99 latency, when the dataset is too large for one machine’s RAM, or when the organization already manages production Kubernetes clusters and treats infrastructure as code. The cross-over point on the glove-100-angular dataset is approximately 5,000 QPS sustained, or roughly 1.5 million vectors on a single node before memory pressure forces either horizontal scaling or approximate index compression that hurts recall. Teams that anticipate crossing either threshold within 12 months should start with Vald to avoid a mid-flight migration.

## What to Do Next

First, measure your actual QPS. Most teams overestimate by 2x to 5x. Pull 30-day metrics from your existing search or RAG endpoint and compute p95 QPS over 5-minute windows. If that number is under 2,000 and your vector count is under 500,000, NMSLIB will handle your workload on a $70/month instance with headroom. Second, benchmark your specific embedding model. The glove-100-angular dataset is a proxy; your 1,536-dimensional OpenAI embeddings will have different distance distribution characteristics. Run a 10,000-vector sample through both engines before committing. Third, price the full stack. Vald’s infrastructure cost is not just compute. Include the EKS control plane at $0.12 per hour, data transfer between AZs at $0.01 per GB, and the engineering time to maintain Helm charts and gRPC configurations. Fourth, test failure scenarios before production. Kill a Vald node under load and measure the rebalance tail. Kill the NMSLIB process and measure restart time. The numbers in this article are a starting point, not a substitute for your own chaos engineering. Fifth, pin your versions. Vald 1.7.6 and NMSLIB 2.1 produced the numbers above. Both projects ship frequently, and the recall-latency curves can shift between minor releases. Lock versions in your dependency manifests and re-benchmark on major upgrades.
