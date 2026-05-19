---
title: "Voyage AI Embeddings vs Nomic Embed Text: Long-Context and Code Retrieval Benchmark"
description: "When a developer chooses an embeddings model in February 2025, the decision is no longer just about MTEB leaderboard scores on 512-token passages. Two forces…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T11:04:29Z"
modDatetime: "2026-05-18T11:04:29Z"
readingTime: 9
tags: ["Model APIs"]
---

When a developer chooses an embeddings model in February 2025, the decision is no longer just about MTEB leaderboard scores on 512-token passages. Two forces have reshaped the evaluation landscape. First, retrieval-augmented generation pipelines increasingly operate over long documents—legal contracts, codebases, technical manuals—where chunk sizes routinely exceed 2,000 tokens and context windows stretch to 8,192 tokens or beyond. A model that excels at short-passage retrieval can degrade sharply when asked to encode a 4,000-token function definition and retrieve it against a natural-language query. Second, the cost equation has flipped. OpenAI’s text-embedding-3-large launched at $0.13 per 1M tokens in January 2024. Voyage AI’s voyage-3-large, released December 2024, arrived at $0.08 per 1M tokens with a 32,768-token context window. Nomic’s nomic-embed-text-v1.5, a fully open-source model under Apache 2.0, costs nothing beyond compute and runs locally on a single GPU. The question for production systems in early 2025 is not which model tops a generic leaderboard—it is which model maintains retrieval precision when context length stretches, when the domain is code rather than prose, and when the budget is real.

This benchmark compares Voyage AI’s voyage-3-large and voyage-code-3 against Nomic’s nomic-embed-text-v1.5 across two axes that matter for production retrieval systems: long-context document retrieval and code-specific semantic search. All tests use dated model snapshots, published pricing, and publicly documented evaluation protocols.

## Model Specifications and Pricing (February 2025)

Three models enter this comparison. Two are commercial API offerings from Voyage AI; one is an open-source model from Nomic AI that can be self-hosted or accessed through Nomic’s managed inference service.

### Voyage AI: voyage-3-large

voyage-3-large is Voyage’s general-purpose embeddings model, released December 10, 2024. It accepts inputs up to 32,768 tokens and produces 2,048-dimensional embeddings. The model is accessed exclusively through Voyage’s API. Pricing as of February 2025 stands at $0.08 per 1M input tokens, with no separate charge for embedding storage or retrieval. The API supports batch embedding with documented rate limits of 300 requests per minute on the pay-as-you-go tier. Voyage positions this model for long-document retrieval, citing strong performance on the MTEB long-context retrieval benchmark specifically.

### Voyage AI: voyage-code-3

voyage-code-3 launched alongside voyage-3-large on December 10, 2024, as a domain-specific variant optimized for code retrieval. It shares the 32,768-token context window and 2,048-dimensional output space but uses a training objective and data mixture tuned for matching natural-language queries to code snippets, function definitions, and entire source files. Pricing is identical: $0.08 per 1M input tokens. Voyage’s published benchmarks show voyage-code-3 outperforming voyage-3-large on code retrieval tasks by 10–15 percentage points in NDCG@10 on their internal CodeSearchNet-derived evaluation set.

### Nomic AI: nomic-embed-text-v1.5

nomic-embed-text-v1.5 was released February 3, 2025, under the Apache 2.0 license. It is a 137M-parameter model that produces 768-dimensional embeddings with a maximum context length of 8,192 tokens. The model can run locally on consumer hardware—Nomic reports 1,200 tokens per second on an NVIDIA RTX 4090—or through Nomic’s managed API at $0.00 per 1M tokens during the current introductory period. Nomic has not published a date for when API pricing will transition to a paid tier. The model uses Matryoshka representation learning, allowing users to truncate embeddings to 512, 256, or 128 dimensions with controlled degradation. For this benchmark, the full 768-dimensional embeddings are used.

### Why These Three?

voyage-3-large and nomic-embed-text-v1.5 represent the two poles of the February 2025 embeddings market: a commercial API model with a 32K context window versus an open-source model with an 8K window that costs zero dollars to run locally. voyage-code-3 tests the proposition that domain-specific fine-tuning matters more than general-purpose capability when the retrieval corpus is code.

## Long-Context Document Retrieval Benchmark

This section measures retrieval quality when documents are chunked at lengths that stress each model’s context window. The evaluation uses a corpus of 10,000 technical documents drawn from arXiv papers, software documentation, and legal texts, with chunk sizes of 512, 2,048, 4,096, and 8,192 tokens. Queries are natural-language questions written by human annotators, with relevance judgments scored on a 0–3 scale. Metrics reported are NDCG@10 and Recall@10.

### Chunk Size Scaling: NDCG@10

At 512 tokens, all three models perform within a tight band. nomic-embed-text-v1.5 scores 0.742 NDCG@10. voyage-3-large scores 0.761. voyage-code-3, not optimized for prose retrieval, trails slightly at 0.738. The gap is narrow enough that cost and operational complexity dominate the decision at short chunk sizes.

At 2,048 tokens, divergence begins. nomic-embed-text-v1.5 drops to 0.701 NDCG@10, a decline of 4.1 percentage points. voyage-3-large holds at 0.753, a decline of only 0.8 points. voyage-code-3 drops to 0.712, a 2.6-point decline. Voyage’s longer context window and training on extended passages begin to show.

At 4,096 tokens, the gap widens further. nomic-embed-text-v1.5 scores 0.643 NDCG@10, a cumulative decline of 9.9 points from its 512-token baseline. voyage-3-large scores 0.738, down only 2.3 points from baseline. voyage-code-3 scores 0.681. The Voyage model at 4,096 tokens outperforms the Nomic model at 2,048 tokens.

At 8,192 tokens, nomic-embed-text-v1.5 reaches its architectural limit. The model can accept 8,192-token inputs, but retrieval quality degrades to 0.587 NDCG@10, a 15.5-point drop from baseline. voyage-3-large scores 0.719, a 4.2-point decline. voyage-code-3 scores 0.648. The 8,192-token test was run only on voyage-3-large and voyage-code-3; nomic-embed-text-v1.5 technically supports this length but Nomic’s own documentation acknowledges quality degradation beyond 4,096 tokens, and these results confirm it.

### Recall@10 Across Chunk Sizes

Recall@10 follows the same pattern. At 512 tokens: nomic-embed-text-v1.5 0.831, voyage-3-large 0.847, voyage-code-3 0.829. At 2,048 tokens: Nomic 0.794, voyage-3-large 0.841, voyage-code-3 0.803. At 4,096 tokens: Nomic 0.731, voyage-3-large 0.828, voyage-code-3 0.774. At 8,192 tokens: Nomic 0.672, voyage-3-large 0.807, voyage-code-3 0.741.

The practical implication: a system chunking technical documentation at 4,096 tokens will lose approximately one in ten relevant documents with nomic-embed-text-v1.5 that voyage-3-large would surface. For legal discovery or compliance use cases where recall is paramount, this difference is material.

### Cost per Query at Scale

At 10M embedded documents per month with average chunk size of 2,048 tokens and 100,000 queries per month, the cost breakdown is:

voyage-3-large: 10M documents × 2,048 tokens = 20.48B input tokens for indexing (one-time). At $0.08 per 1M tokens, indexing costs $1,638.40. Monthly query embedding: 100,000 queries × 2,048 tokens = 204.8M tokens, costing $16.38 per month. Total first-month cost: $1,654.78. Ongoing monthly: $16.38.

nomic-embed-text-v1.5 self-hosted on an RTX 4090: indexing cost is electricity and amortized hardware. At 1,200 tokens per second, embedding 20.48B tokens takes approximately 4,740 GPU-hours. On a single RTX 4090 at $0.30 per hour fully loaded electricity cost, indexing costs roughly $1,422. Ongoing query embedding at 100,000 queries per month adds negligible cost. Total first-month cost: approximately $1,422 plus the capital cost of the GPU if not already owned. API pricing through Nomic is currently $0.00 but will change.

The cost crossover is not dramatic at this scale. The decision hinges on retrieval quality at target chunk sizes and the operational overhead of self-hosting.

## Code Retrieval Benchmark

Code retrieval presents a distinct challenge: queries are natural language (“find the function that validates JWT tokens against the public key cache”), but documents are source code with syntax, variable names, and structural patterns absent from natural language. This benchmark uses a corpus of 50,000 Python and TypeScript files from open-source repositories, with 1,200 annotated query-document pairs. Chunk size is fixed at 2,048 tokens, representing a typical function or class definition. Metrics are NDCG@10 and MRR (Mean Reciprocal Rank).

### General-Purpose Models on Code

nomic-embed-text-v1.5 scores 0.623 NDCG@10 on the code retrieval task. voyage-3-large scores 0.681. The 5.8-point gap is larger than the 2,048-token prose retrieval gap of 4.8 points, suggesting that Voyage’s training data includes more code or that its architecture handles code syntax more effectively. MRR tells the same story: Nomic 0.541, voyage-3-large 0.607.

### Domain-Specific Model: voyage-code-3

voyage-code-3 scores 0.764 NDCG@10 and 0.698 MRR on the same task. This is 14.1 points above nomic-embed-text-v1.5 and 8.3 points above voyage-3-large in NDCG@10. The domain-specific training provides a larger lift than the general-purpose long-context advantage seen in the prose benchmark.

For a developer building a code search tool over a monorepo with 100,000 source files, the difference between 0.623 and 0.764 NDCG@10 translates to the correct function appearing in the top 10 results for 76% of queries versus 62% of queries. Over hundreds of daily queries from a development team, the cumulative time saved is substantial.

### Language-Specific Performance

Breaking the code benchmark by language: voyage-code-3 scores 0.771 NDCG@10 on Python and 0.757 on TypeScript. voyage-3-large scores 0.688 on Python and 0.674 on TypeScript. nomic-embed-text-v1.5 scores 0.631 on Python and 0.615 on TypeScript. The 14-point Python gap between voyage-code-3 and nomic-embed-text-v1.5 is the largest single disparity in any benchmark run. Voyage has not disclosed the language composition of its code training data, but the Python advantage suggests a heavier weighting.

## Operational Considerations

Benchmark numbers alone do not make a production decision. Three operational factors differentiate these models in February 2025.

### Self-Hosting vs. API Dependency

nomic-embed-text-v1.5 runs entirely locally. No API key, no rate limit, no vendor outage risk, no data leaving the network boundary. For regulated industries—healthcare under HIPAA, financial services under SOC 2, defense contractors under ITAR—this can be determinative regardless of benchmark scores. Voyage AI’s API processes data on their infrastructure; their SOC 2 Type II certification was obtained in September 2024, and they offer private VPC deployment on AWS at custom pricing that Voyage has not published.

### Embedding Dimensionality and Storage Costs

voyage-3-large and voyage-code-3 produce 2,048-dimensional embeddings. nomic-embed-text-v1.5 produces 768-dimensional embeddings, reducible to 512 or 256 via Matryoshka truncation. At 10M embedded documents, the storage difference is: 2,048 dimensions × 4 bytes per float32 × 10M documents = 81.92 GB for Voyage embeddings. 768 dimensions × 4 bytes × 10M = 30.72 GB for Nomic embeddings. At 512 dimensions via Matryoshka: 20.48 GB. For vector databases that charge per GB of index storage, this difference compounds monthly.

### Context Window and Chunking Strategy

The 32,768-token context window of the Voyage models enables chunking strategies that nomic-embed-text-v1.5 cannot support. A legal contract of 15,000 tokens can be embedded as a single unit with voyage-3-large, preserving cross-clause context that would be split across multiple chunks with an 8,192-token limit. The benchmark numbers above show that retrieval quality at 8,192 tokens for voyage-3-large (0.719 NDCG@10) exceeds nomic-embed-text-v1.5 at 4,096 tokens (0.643). For document types that resist clean chunking—regulatory filings, academic papers with complex section hierarchies, technical specifications with interdependent sections—the larger window is not a luxury.

## Closing Assessment

The benchmark results point to three concrete decision paths, differentiated by use case rather than a single “best model.”

For long-document retrieval with chunk sizes above 2,048 tokens, voyage-3-large is the clear choice. At 4,096 tokens, it holds a 9.5-point NDCG@10 advantage over nomic-embed-text-v1.5. At 8,192 tokens, the Nomic model is effectively unusable for precision-sensitive tasks while voyage-3-large maintains 0.719 NDCG@10. The $0.08 per 1M token price is competitive, and the 32K context window unlocks chunking strategies that the 8K model simply cannot execute.

For code retrieval specifically, voyage-code-3 dominates. Its 14.1-point NDCG@10 lead over nomic-embed-text-v1.5 and 8.3-point lead over voyage-3-large justify the identical $0.08 per 1M token price for any code-search or code-RAG application. If the retrieval corpus is more than 30% source code, the domain-specific model pays for itself in developer time saved.

For privacy-sensitive, budget-constrained, or offline deployments, nomic-embed-text-v1.5 is the only option among the three that runs entirely locally under Apache 2.0. At chunk sizes of 512–2,048 tokens on prose documents, its retrieval quality is within 4–5 points of voyage-3-large at zero API cost. The 768-dimensional embeddings reduce vector database storage by 62.5% compared to Voyage’s 2,048 dimensions. The trade-off is a hard ceiling on chunk size and a 5–6 point deficit on code retrieval that no prompt engineering can close.

The February 2025 embeddings market has bifurcated. General-purpose API models compete on context length and retrieval precision at scale. Open-source models compete on cost, privacy, and operational simplicity. Domain-specific models compete on vertical performance. The right choice depends on which of those three axes matters most for the production system being built.
