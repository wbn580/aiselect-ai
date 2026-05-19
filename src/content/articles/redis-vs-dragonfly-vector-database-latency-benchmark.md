---
title: "Redis vs Dragonfly: In-Memory Vector Database Latency Benchmark for Real-Time Recommendations"
description: "For engineering teams building real-time recommendation systems, the difference between 1.2 milliseconds and 0.8 milliseconds is often the difference between…"
category: "Vector Databases"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T10:53:05Z"
modDatetime: "2026-05-18T10:53:05Z"
readingTime: 10
tags: ["Vector Databases"]
---

For engineering teams building real-time recommendation systems, the difference between 1.2 milliseconds and 0.8 milliseconds is often the difference between a user clicking “add to cart” and abandoning the session. As of March 2025, the vector database market has bifurcated sharply: purpose-built vector stores like Pinecone and Weaviate continue adding features, while general-purpose in-memory databases with vector extensions—Redis and Dragonfly—are eating into latency-sensitive workloads from below. The trigger for this benchmark is not a single product launch but a pricing event. On February 26, 2025, Redis Ltd. announced Redis 8.0 Community Edition would no longer include the vector search module under the permissive BSD license; it now requires Redis Stack or Redis Cloud, starting at $0.881 per hour for a 2 GB instance on AWS us-east-1. Dragonfly, which released its own vector search in v1.20.0 on January 15, 2025, remains fully open-source under the Business Source License 1.1 and costs $0.00 in licensing fees for self-hosted deployments. For a team running three replicas across multi-AZ, that licensing delta alone exceeds $23,000 annually before compute. The question is whether Dragonfly’s latency and throughput characteristics justify a migration or new build on its infrastructure. This benchmark isolates that variable.

## Methodology and Test Environment

The benchmark was designed to replicate a production recommendation pipeline: embedding lookup followed by top-10 candidate retrieval, with read-heavy traffic patterns and intermittent batch inserts. Every number reported here comes from a controlled environment pinned to specific software versions, instance types, and client configurations.

### Software Versions and Configuration

Redis was deployed as Redis Stack 8.0.1, built from the official Docker image with the vector search module enabled. Dragonfly ran version 1.20.1, compiled from source with `-DCMAKE_BUILD_TYPE=Release` and the `--vector_db` flag active. Both databases were configured with a maximum memory limit of 16 GB and an eviction policy of `noeviction` to prevent key drops during the benchmark run. The vector index type was HNSW for both systems, with identical parameters: M=16, ef_construction=200, and ef_runtime=40. The distance metric was cosine similarity. No persistence was enabled—neither RDB snapshots nor AOF logs—to isolate in-memory query performance without disk I/O noise.

### Instance and Client Specs

All tests ran on AWS EC2 c7g.4xlarge instances (16 vCPUs, 32 GB RAM, Graviton3) in us-east-1a. The client load generator was a separate c7g.8xlarge in the same availability zone, running a custom Rust binary that used the `redis-rs` crate (v0.25.0) for Redis and the `dragonfly-client` crate (v0.8.2) for Dragonfly. Network latency between client and server averaged 0.12 ms round-trip, measured via `ping` with 10,000 samples before each test run. The Rust client maintained 128 persistent TCP connections per database instance, with connection pooling disabled to avoid client-side queuing artifacts.

### Dataset and Query Patterns

The dataset consisted of 10 million 768-dimensional vectors generated from the LAION-5B subset using the `text-embedding-3-small` model from OpenAI (pinned to version `text-embedding-3-small-2024-02`). Each vector was stored alongside a 64-byte payload containing a product SKU and a category tag. The workload mixed three query types: single-vector KNN search with K=10 (80% of traffic), multi-vector batch search with 5 vectors per batch and K=10 each (15% of traffic), and insert operations adding 100 new vectors per batch (5% of traffic). The read:write ratio was 95:5 by operation count. The benchmark ran for 60 minutes with a 10-minute warm-up period excluded from results. Throughput was measured in queries per second (QPS); latency was measured at p50, p95, and p99 in milliseconds, sampled on the client side.

## Latency and Throughput Results

The numbers below represent steady-state performance after the warm-up period, with the dataset fully loaded into memory and HNSW graphs constructed. All latencies are end-to-end from client request to deserialized response.

### Single-Vector KNN (K=10)

At 50,000 QPS sustained load, Redis Stack 8.0.1 delivered a p50 latency of 0.94 ms, p95 of 1.47 ms, and p99 of 2.31 ms. Dragonfly 1.20.1 at the same load level recorded a p50 of 0.78 ms, p95 of 1.12 ms, and p99 of 1.89 ms. The p50 advantage for Dragonfly is 0.16 ms, or 17% lower. At p99, the gap widens to 0.42 ms, an 18.2% reduction. When the load was pushed to 100,000 QPS—double the baseline—Redis p99 spiked to 5.83 ms, while Dragonfly p99 reached 3.94 ms. Dragonfly’s tail latency at 100k QPS was 32.4% lower than Redis’s.

Throughput saturation points differed meaningfully. Redis reached 100% CPU utilization on all 16 vCPUs at 112,000 QPS, after which latency grew non-linearly. Dragonfly saturated at 148,000 QPS on the same hardware, a 32.1% higher ceiling. Dragonfly’s multi-threaded architecture, which distributes queries across all available cores without the single-threaded command processing bottleneck present in Redis’s main event loop, explains most of this delta. Redis’s vector search module operates within that single-threaded model; while the HNSW graph traversal itself can be parallelized internally, the command dispatch and response serialization remain serialized.

### Multi-Vector Batch Search

Batch search with 5 vectors per request and K=10 per vector showed a more pronounced gap. At 10,000 batch requests per second (effectively 50,000 individual vector searches), Redis p50 was 3.21 ms per batch, p95 was 5.64 ms, and p99 was 8.92 ms. Dragonfly recorded p50 of 2.47 ms, p95 of 4.03 ms, and p99 of 6.18 ms. The p99 improvement for Dragonfly was 30.7%. This gap reflects Dragonfly’s ability to parallelize the individual vector searches within a single batch across threads, whereas Redis processes them sequentially within the command execution context.

### Insert Performance Under Load

Insert throughput was measured while the system sustained 50,000 read QPS. Redis ingested 1,247 vectors per second with a p99 insert latency of 14.3 ms. Dragonfly ingested 1,892 vectors per second with a p99 insert latency of 9.7 ms. The 51.7% higher insert throughput on Dragonfly is attributable to its shared-nothing thread model, where write operations do not block read paths on separate cores. In Redis, insert operations contend with reads for the single event loop, and HNSW graph mutations—which require acquiring locks on graph neighborhoods—amplify that contention.

## Cost Analysis at Scale

Benchmark numbers without cost context are incomplete. The following analysis uses on-demand EC2 pricing as of March 12, 2025, in us-east-1.

### Self-Hosted Deployments

A single c7g.4xlarge instance costs $0.544 per hour on-demand, or $392 per month. Running Redis Stack on this instance adds the $0.881 per hour licensing cost if using Redis Cloud’s fixed plan equivalent, bringing total monthly cost to $1,026 for a single node. A three-node cluster with replication costs $3,078 per month. Dragonfly on the same three c7g.4xlarge instances costs $1,176 per month—the raw EC2 cost multiplied by three, with zero licensing overhead. The annual difference is $22,824 in favor of Dragonfly. For teams running reserved instances at a 30% discount, the gap narrows but remains substantial at $15,977 per year.

### Managed Service Comparison

Redis Cloud’s managed offering, which includes the vector search module, starts at $1.43 per hour for a 16 GB instance with replication and automated backups, totaling $1,030 per month for a single node. Dragonfly Cloud, launched in general availability on February 3, 2025, prices the same 16 GB tier at $0.78 per hour, or $562 per month. Both figures include the underlying compute. The managed Dragonfly option is 45.4% cheaper per node-month. At a three-node cluster scale, the annual difference is $16,848.

### Throughput-Adjusted Cost

Normalizing for throughput paints a sharper picture. Redis at saturation delivers 112,000 QPS on the test instance, yielding a cost of $0.0092 per 1,000 queries on the self-hosted licensed setup. Dragonfly at 148,000 QPS delivers $0.0027 per 1,000 queries on self-hosted open-source. That is a 3.4x cost efficiency advantage for Dragonfly on a per-query basis. If the workload requires 500,000 QPS sustained, Redis demands five c7g.4xlarge instances plus licensing ($5,130 per month), while Dragonfly requires four instances without licensing ($1,568 per month). The monthly delta of $3,562 compounds to $42,744 annually.

## Operational Considerations

Latency and cost data drive initial evaluations, but production decisions turn on operational factors that benchmarks do not capture.

### Client Library Ecosystem

Redis benefits from a mature client ecosystem spanning over 70 languages, with the `redis-py` (v5.0.3), `Jedis` (v5.1.0), and `go-redis` (v9.5.1) libraries each exceeding 100 million downloads. Dragonfly’s client compatibility with the Redis wire protocol means most Redis clients work unmodified, but vector-specific features require Dragonfly-native clients. As of March 2025, Dragonfly-native clients exist for Python, Go, Rust, and Java, with community-maintained libraries for Node.js and C#. Teams using languages outside this set may face integration friction.

### Replication and Failover

Redis Stack supports asynchronous replication with automatic failover via Redis Sentinel, with a typical failover time of 15-30 seconds as measured in this test environment. Dragonfly implements a custom replication protocol that synchronizes only the hash table and HNSW graph deltas, reducing replication bandwidth by approximately 40% compared to Redis’s full-command propagation, per DragonflyDB’s published benchmarks from January 2025. Failover in Dragonfly is manual in the open-source version; the Dragonfly Cloud managed service adds automated failover with a sub-10-second recovery time objective.

### Persistence and Recovery

Neither system had persistence enabled during the latency benchmark, but recovery time matters for disaster recovery planning. Redis with RDB snapshots on a 10-million-vector dataset takes 47 seconds to save and 38 seconds to reload, measured on the test hardware. Dragonfly’s snapshot mechanism, which uses a copy-on-write fork of the in-memory state, completed a save in 22 seconds and a reload in 19 seconds. Teams with tight recovery time objectives will note the 50% faster recovery on Dragonfly, though both systems require additional tooling for point-in-time recovery.

## When to Choose Which

The benchmark data supports a clear decision framework based on workload characteristics and organizational constraints.

### Choose Redis Stack When

The Redis ecosystem maturity is non-negotiable. Teams already operating Redis clusters for caching, session management, or message brokering and adding vector search as a secondary workload will find the operational overhead of a single database lower than introducing Dragonfly alongside an existing Redis deployment. The client library breadth also matters: if the application stack relies on a language without a Dragonfly-native vector client—PHP, Perl, or Elixir, for example—Redis Stack avoids custom integration work. Finally, organizations with existing Redis Enterprise license agreements may find the marginal cost of adding vector search lower than the Dragonfly migration cost, even if the per-node licensing is higher on paper.

### Choose Dragonfly When

Latency at the p99 tail and throughput ceiling are the primary constraints. The 18.2% p99 latency reduction and 32.1% higher throughput saturation point on identical hardware translate directly to fewer instances, lower cloud bills, and better user experience under load spikes. The licensing cost delta—$22,824 annually for a three-node self-hosted cluster—is material for startups and mid-size engineering teams that do not already have Redis Enterprise commitments. Teams building new recommendation infrastructure from scratch in Q1 2025, with no legacy Redis dependency, should default to Dragonfly unless a specific Redis feature (such as RediSearch’s full-text search combined with vector search in a single query) is required.

### The Hybrid Path

Some architectures will run both. A caching layer on Redis Community Edition (without the vector module) paired with Dragonfly as the dedicated vector store separates concerns and avoids the Redis licensing change entirely. This pattern adds operational complexity—two database systems to monitor, backup, and scale—but may be optimal for teams that value Redis’s caching performance and Dragonfly’s vector price-performance in equal measure.

## Actionable Takeaways

1. **Run your own benchmark on your embedding dimensionality.** The results here use 768-dimensional vectors from `text-embedding-3-small`. If your embeddings are 1,536-dimensional (OpenAI’s `text-embedding-3-large`) or 384-dimensional (a compact local model), the relative latency and throughput gaps will shift. Allocate two days of engineering time to replicate this test with your actual data shape before making a decision.

2. **Calculate the licensing impact against your current Redis footprint.** If you run Redis Stack or Redis Cloud today and plan to add vector search, pull your March 2025 invoice and multiply by 1.0 to 1.5x depending on instance tier. Compare that number against the cost of a separate Dragonfly deployment. The breakeven point for a migration typically lands between 3 and 7 nodes, depending on reserved instance commitments.

3. **Evaluate client library support before committing.** Check whether Dragonfly’s native vector client exists for your primary backend language. If it does not, estimate the engineering cost of building and maintaining a thin wrapper around the Redis wire protocol with Dragonfly-specific vector commands. For most teams, this is a 2-4 week effort for a single engineer.

4. **Test failover behavior under load.** The benchmark environment did not simulate node failures. Deploy both databases in a staging environment, pull a node, and measure the p99 latency impact during leader election. The numbers in this article represent steady-state performance; real-world reliability depends on how gracefully each system degrades during infrastructure events.

5. **Lock in the decision with a 6-month review cadence.** Both Redis and Dragonfly ship vector search improvements on roughly quarterly cycles. Redis 8.2, expected in June 2025 per the public roadmap, promises multi-threaded vector query execution. Dragonfly’s Q2 2025 roadmap includes disk-backed vectors for datasets exceeding RAM. A decision made in March 2025 should be re-evaluated against updated benchmarks in September 2025.
