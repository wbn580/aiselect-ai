---
title: "Google Vertex AI Text Embeddings Gecko vs Ada-002 on MTEB"
description: "The decision to move an entire retrieval pipeline to a new embedding model is not made lightly. In production systems, embeddings are foundational infrastruc…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:51:14Z"
modDatetime: "2026-05-18T08:51:14Z"
readingTime: 9
tags: ["Model APIs"]
---

The decision to move an entire retrieval pipeline to a new embedding model is not made lightly. In production systems, embeddings are foundational infrastructure: swap them out and every downstream similarity score, every cached vector, and every hand-tuned threshold breaks. For most of 2023, OpenAI’s text-embedding-ada-002 served as the default choice for teams that wanted a single API call to produce a 1536-dimensional vector that performed competently across classification, clustering, and retrieval tasks. It was not always the best model on any single benchmark, but it was reliable, well-documented, and cheap enough at $0.0001 per 1,000 tokens that the operational cost of switching rarely penciled out.

That calculus shifted in late 2024. Google’s Vertex AI Text Embeddings Gecko family, first previewed in mid-2023, reached general availability with a pricing structure and latency profile that forced a reappraisal. On October 1, 2024, Google dropped the per-1,000-token price for the `textembedding-gecko@003` model to $0.000025, undercutting ada-002 by a factor of four. Simultaneously, the Massive Text Embedding Benchmark (MTEB) leaderboard updated its rankings with Gecko variants posting retrieval scores that exceeded ada-002 by margins large enough to matter in recall-sensitive applications. For a team serving 100 million embedding requests per month, the difference between $2,500 and $10,000 in monthly inference cost is real money that could fund an additional engineer. This article examines the Gecko family as it stood in November 2024, comparing benchmark performance, pricing, dimensionality trade-offs, and the practical implications of adopting Vertex AI embeddings over the incumbent OpenAI offering.

## The Gecko Model Family: Versions, Dimensions, and Capabilities

Google did not release a single embedding model. The Gecko lineage on Vertex AI comprises multiple versions, each with distinct dimensionality and task specialisation. Understanding which variant to select requires mapping the model name to its intended workload.

### Model Identifiers and Release Timeline

As of November 2024, three Gecko text embedding models are generally available on Vertex AI. The `textembedding-gecko@001` model, released in June 2023, produces 768-dimensional vectors and served as the initial entry point. It was followed by `textembedding-gecko@002` in December 2023, which introduced support for 256-, 512-, and 768-dimensional outputs via a configurable output dimensionality parameter. The current production recommendation is `textembedding-gecko@003`, made generally available in May 2024, which added a 1024-dimensional option and improved MTEB retrieval scores by approximately 2.5 percentage points over the @002 variant on the same dimensionality.

A fourth model, `text-embedding-004`, appeared in Vertex AI’s model garden in September 2024 with a 2048-dimensional output option and a reported MTEB average of 64.8 across all task categories, but it remained in preview at the time of writing and is excluded from the production pricing comparisons below.

### Task-Specific Optimisation

The Gecko models accept a `task_type` parameter that instructs the serving infrastructure to apply a task-specific adapter. Available values include `RETRIEVAL_QUERY`, `RETRIEVAL_DOCUMENT`, `SEMANTIC_SIMILARITY`, `CLASSIFICATION`, `CLUSTERING`, and `QUESTION_ANSWERING`. This design means the same model weights produce different embeddings depending on whether the text is a short search query or a long document passage. In practice, teams must ensure that queries and documents are embedded with their respective task types, otherwise cosine similarity comparisons degrade. Google’s internal testing, published in the Vertex AI documentation on August 15, 2024, showed that using mismatched task types (embedding both query and document with `RETRIEVAL_DOCUMENT`) reduced top-10 recall by 4.1 percentage points on the BEIR nfcorpus dataset compared to the correct query-document pairing.

### Dimensionality and the Storage-Performance Trade-Off

Vector databases charge by dimension. Reducing a 1536-dimensional ada-002 vector to a 768-dimensional Gecko vector halves the storage footprint and roughly halves the index build time. The `textembedding-gecko@003` model at 768 dimensions achieves an MTEB retrieval score of 55.1, while ada-002 scores 52.0 on the same benchmark, according to the MTEB leaderboard snapshot from November 10, 2024. The 256-dimensional Gecko variant scores 51.8 on retrieval—essentially matching ada-002’s 1536-dimensional performance while using one-sixth the storage. For a vector database holding 50 million document chunks, the storage difference between 1536 dimensions (approximately 307 GB in float32) and 256 dimensions (approximately 51 GB) can determine whether the entire index fits in memory on a single node.

## MTEB Benchmark Analysis: Gecko@003 vs Ada-002

The MTEB leaderboard provides the most widely cited comparison point for embedding models. The November 10, 2024 snapshot includes scores for both `textembedding-gecko@003` (768 dimensions) and `text-embedding-ada-002` across seven task categories.

### Retrieval Performance

Retrieval is the category that matters most for RAG pipelines and semantic search. On the MTEB retrieval average across 15 datasets, `textembedding-gecko@003` at 768 dimensions scored 55.1, while ada-002 scored 52.0. The 3.1-point gap is significant: on the BEIR subset of retrieval tasks, a 3-point improvement in nDCG@10 typically corresponds to a 6-8% improvement in the proportion of queries where the correct document appears in the top 10 results, based on the correlation analysis published alongside the BEIR benchmark in April 2022.

At 1024 dimensions, Gecko@003 reaches 56.3 on MTEB retrieval, widening the gap to 4.3 points. The 256-dimensional variant scores 51.8, which is statistically indistinguishable from ada-002’s 52.0 given the benchmark’s measurement variance of approximately ±0.3 points. This means a team currently using ada-002 can switch to Gecko@003 at 256 dimensions, reduce vector storage by 83%, maintain equivalent retrieval quality, and cut embedding costs by 75%.

### Classification, Clustering, and Pair Classification

On the MTEB classification average, Gecko@003 (768d) scored 67.2 versus ada-002’s 64.1. The clustering average showed a narrower gap: 46.4 for Gecko@003 versus 45.2 for ada-002. Pair classification, which measures the model’s ability to determine whether two texts are semantically equivalent, came in at 85.7 for Gecko@003 and 84.3 for ada-002. These margins are consistent but not transformative for most applications. The retrieval delta is the primary driver of the business case for migration.

### Semantic Similarity and Summarization

Semantic textual similarity (STS) benchmarks measure the correlation between model-predicted similarity scores and human judgments. Gecko@003 scored 84.9 on STS versus 82.0 for ada-002. The summarization category, which evaluates how well embeddings capture the content of a summary relative to the source text, showed Gecko@003 at 31.5 and ada-002 at 30.8. These categories are less frequently cited in production procurement decisions, but they indicate that Gecko’s advantage is not limited to retrieval.

## Pricing and Throughput: The Operational Case for Switching

Benchmarks inform capability; pricing determines feasibility at scale. The Vertex AI text embeddings pricing page, last updated October 1, 2024, lists `textembedding-gecko@003` at $0.000025 per 1,000 characters of input text. OpenAI’s pricing page, as of November 2024, lists `text-embedding-ada-002` at $0.00010 per 1,000 tokens. The unit mismatch—characters versus tokens—complicates direct comparison.

### Character-Based vs Token-Based Pricing

A token is approximately 4 characters in English text, though the ratio varies by language and content type. For a representative English-language corpus of technical documentation, 1,000 tokens corresponds to roughly 3,800 characters. This means the effective price per 1,000 tokens for Gecko@003 is approximately $0.000095, making it marginally cheaper than ada-002 on a per-token basis. However, the dimensionality reduction factor dominates the cost equation. A team that accepts the 256-dimensional Gecko embedding achieves equivalent retrieval quality to ada-002 at one-quarter the per-token cost and one-sixth the storage cost. At 100 million embedding requests per month, averaging 500 tokens per request, the monthly inference bill drops from $5,000 (ada-002) to approximately $1,250 (Gecko@003 at 256d), a saving of $45,000 annually.

### Latency and Rate Limits

Vertex AI imposes a default quota of 1,500 requests per minute for text embedding predictions, with the option to request increases. OpenAI’s embedding API offers 3,000 requests per minute on the pay-as-you-go tier. In practice, both services return embeddings in under 100 milliseconds for single-document requests. Batch processing throughput is comparable, with both APIs supporting parallel requests up to their respective rate limits. The operational differentiator is not raw speed but the reduced index build time from lower-dimensional vectors, which accelerates deployment cycles when re-indexing large corpora.

### Multi-Region Deployment and Data Residency

Vertex AI allows embedding inference to be pinned to specific Google Cloud regions, including us-central1, europe-west4, and asia-southeast1. This matters for teams subject to data residency requirements under GDPR or similar regulations. OpenAI’s embedding API routes through US-based infrastructure by default, with limited regional controls available only under enterprise agreements. For European startups handling user-generated content, the ability to guarantee that text never leaves an EU region can be a hard requirement that eliminates ada-002 from consideration regardless of benchmark scores.

## Migration Considerations and Production Pitfalls

Switching embedding models is a data migration project, not a configuration change. Teams that underestimate the operational complexity risk silent degradation of search quality.

### Vector Incompatibility Across Model Versions

Embeddings from different models are not interchangeable. Cosine similarity scores between a query embedded with Gecko@003 and a document embedded with ada-002 are meaningless. A full re-index of the document corpus is required. For a corpus of 10 million documents, re-indexing with Gecko@003 at 768 dimensions takes approximately 2.5 hours using a 16-vCPU node on Google Cloud, based on throughput of 1,100 requests per second. During the re-indexing window, the system must either serve from a stale index or maintain dual indexes, doubling storage costs temporarily.

### Task Type Configuration Errors

The `task_type` parameter is a footgun. If a developer configures the retrieval pipeline to embed queries with the default task type (which maps to `SEMANTIC_SIMILARITY`) instead of `RETRIEVAL_QUERY`, the MTEB retrieval score drops by an estimated 2-3 points based on Google’s published ablation data. This class of error is difficult to detect in staging because the degradation is gradual rather than catastrophic. A recommendation is to encode the task type in the deployment configuration as a mandatory parameter with a validation test that compares embedding cosine similarity against a known query-document pair.

### SDK and API Surface Differences

Vertex AI embeddings are accessed via the Vertex AI Python SDK or REST API, not the Google AI Studio client library. The SDK requires a Google Cloud project with billing enabled and the Vertex AI API activated. Authentication uses service account credentials or application default credentials, which adds a layer of setup complexity compared to OpenAI’s API key model. Teams using LangChain or LlamaIndex can swap the embedding class from `OpenAIEmbeddings` to `VertexAIEmbeddings` with approximately 10 lines of code changed, but they must also update the vector store schema to accept the new dimensionality.

## What to Do Next

The benchmark data and pricing from November 2024 point to a clear conclusion for teams evaluating embedding providers, but the decision to migrate depends on the specific constraints of each production system. Five actionable steps follow.

First, audit your current retrieval quality. Run the MTEB retrieval evaluation script against your own document corpus and query set using both ada-002 and Gecko@003 at 768 dimensions. A 3-point gap on public benchmarks does not guarantee a 3-point gap on your data. Measure nDCG@10 and recall@10 on a representative sample of at least 1,000 queries before committing to a migration.

Second, calculate the storage cost of your current vector index. If you are running a self-hosted vector database on provisioned infrastructure, the cost of RAM or SSD storage scales linearly with dimensionality. Determine whether dropping from 1536 to 768 or 256 dimensions would allow you to downsize instances or extend the time between index rebuilds.

Third, test the 256-dimensional Gecko variant first. The MTEB retrieval score of 51.8 is functionally equivalent to ada-002’s 52.0, and the storage reduction is substantial. If your application is latency-sensitive, the smaller index will also reduce query time due to fewer distance computations per vector comparison.

Fourth, implement the task type parameter correctly from day one. Write an integration test that embeds a known query-document pair with the expected task types and asserts that the cosine similarity exceeds a threshold. This test will catch misconfigurations before they reach production.

Fifth, pin your model version. The `textembedding-gecko@003` identifier is stable, but Google’s preview of `text-embedding-004` signals that the Gecko family will continue to evolve. When a new version becomes generally available, re-run your evaluation suite before upgrading. Embedding model upgrades are not drop-in replacements; they require the same rigor as database schema migrations.
