---
title: "Cohere Embed v3 Performance on the MTEB Leaderboard"
description: "The MTEB leaderboard, maintained by Hugging Face, has become the de facto yardstick for comparing text embedding models. When Cohere released Embed v3 in Nov…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:17:35Z"
modDatetime: "2026-05-18T08:17:35Z"
readingTime: 7
tags: ["Model APIs"]
---

The MTEB leaderboard, maintained by Hugging Face, has become the de facto yardstick for comparing text embedding models. When Cohere released Embed v3 in November 2023, the model did not merely edge past competitors on a single metric. It posted a top-1 score on the overall MTEB English leaderboard at 64.0, displacing the then-leader bge-large-en-v1.5 (63.3) and opening a measurable gap over OpenAI’s text-embedding-ada-002 (60.9). Those three digits matter because an embedding model’s quality determines downstream performance for retrieval-augmented generation (RAG) pipelines, semantic search, clustering, and classification. A difference of 0.7 points on the MTEB aggregate translates to fewer hallucinated answers, lower reranking latency, and reduced token waste when developers ship production systems. The timing is also material: as of September 2024, Cohere’s pricing for Embed v3 sits at $0.10 per million tokens for the English variant and $0.13 per million tokens for Multilingual, while OpenAI’s text-embedding-3-large costs $0.13 per million tokens. The cost-performance intersection is shifting, and teams evaluating embedding backends need to re-examine stale benchmarks from mid-2023.

## MTEB Scores and What They Actually Measure

The Massive Text Embedding Benchmark (MTEB) is not a single test. It spans 8 task categories and 58 datasets as of the August 2024 leaderboard refresh, covering classification, clustering, pair classification, reranking, retrieval, semantic textual similarity (STS), summarization, and bitext mining. Cohere Embed v3’s 64.0 overall score is an unweighted average across all tasks, but the breakdown reveals where the model earns its keep and where it trades off.

### Retrieval: The RAG Workhorse

Retrieval is the category that most directly impacts RAG applications. On the MTEB retrieval subset, Embed v3 scored 59.0, compared to 57.1 for bge-large-en-v1.5 and 55.4 for text-embedding-ada-002. The datasets behind that number include BEIR benchmarks (NFCorpus, FiQA, ArguAna, SCIDOCS) and MS MARCO. For a developer running a customer support chatbot over a 10-million-document corpus, a 1.9-point retrieval improvement means the correct document appears in the top-5 results more often, reducing the need for expensive reranking passes. Cohere’s November 2023 technical report notes that Embed v3 uses Matryoshka-style representation learning with variable embedding dimensions, allowing the same model to produce embeddings at 1024, 512, 256, or 128 dimensions without retraining. At 256 dimensions, retrieval performance drops only 1.2 points compared to the full 1024-dimension output, which cuts vector database storage costs by roughly 75%.

### Semantic Textual Similarity and Classification

On STS, Embed v3 posted 83.2, trailing slightly behind bge-large-en-v1.5 (83.5) but ahead of text-embedding-ada-002 (81.0). The STS category measures how well embeddings capture paraphrase and sentence equivalence, which matters for deduplication pipelines and content moderation. Classification performance sits at 76.8, a category where the model’s compression-aware training shows an edge: even at 128 dimensions, classification accuracy holds within 2.5 points of the full-dimensional output. This dimension-flexible design is not a gimmick. It means a single API call can return embeddings sized for a Pinecone index tuned for recall (1024d) while simultaneously serving a lightweight 128d embedding for a fast k-NN classifier running on CPU.

## Multilingual Performance and the Embed v3 Multilingual Variant

Cohere shipped two variants in November 2023: Embed v3 English and Embed v3 Multilingual. The Multilingual model was not evaluated on the English-only MTEB leaderboard, but Cohere’s own published results on the MIRACL benchmark—a multilingual retrieval test covering 18 languages—show a mean nDCG@10 of 58.3. For comparison, OpenAI’s text-embedding-3-large reports 54.9 on the same MIRACL subset, and bge-m3 (BAAI’s February 2024 multilingual model) scores 56.1. The gap is largest on low-resource languages: on Swahili retrieval, Embed v3 Multilingual achieves 42.7 nDCG@10 versus 31.2 for text-embedding-3-large. Developers building global-facing search should note that the Multilingual variant costs $0.13 per million tokens, identical to OpenAI’s large model but with higher throughput at 10,000 tokens per second per API key.

### Input Token Limits and Practical Throughput

Embed v3 accepts up to 512 tokens per input, compared to 8,191 for text-embedding-3-large. For chunking strategies that target 256–512 tokens per passage, this limit is adequate. Teams embedding long documents must chunk anyway, and the 512-token ceiling forces discipline that often improves retrieval precision. Throughput benchmarks from Cohere’s November 2023 launch show 10,000 tokens per second for the English variant and 8,000 tokens per second for Multilingual, measured on a single API key with batch size 96. In practice, a 1-million-document corpus averaging 400 tokens per document embeds in approximately 40 seconds on English and 50 seconds on Multilingual, assuming no rate limiting. OpenAI’s text-embedding-3-large processes at roughly 5,000 tokens per second under comparable conditions, per third-party benchmarks published by Anyscale in January 2024.

## Cost Analysis for Production Deployments at Scale

Embedding costs are linear in token volume, but the dimension-flexible output changes the storage equation. Consider a production RAG system with 50 million document chunks, each embedded at 1024 dimensions using float32 precision. Vector storage requires approximately 200 GB. Reducing dimensions to 256 cuts storage to 50 GB. At Pinecone’s September 2024 pricing of $0.33 per GB per month for standard pods, that difference saves $594 per month, or $7,128 per year. The trade-off is a retrieval recall drop of roughly 1.2 points on MTEB, which may be acceptable for many use cases.

### Token Cost Comparison Table (September 2024 Pricing)

| Model | Price per 1M tokens | 50M chunks (400 tok/chunk) | Annual token cost |
|---|---|---|---|
| Cohere Embed v3 English | $0.10 | 20B tokens | $2,000 |
| Cohere Embed v3 Multilingual | $0.13 | 20B tokens | $2,600 |
| OpenAI text-embedding-3-large | $0.13 | 20B tokens | $2,600 |
| OpenAI text-embedding-3-small | $0.02 | 20B tokens | $400 |

The small OpenAI model is cheaper but scores 61.2 on MTEB overall, 2.8 points below Embed v3. For founders optimizing burn rate, the $2,200 annual delta between Cohere English and OpenAI small buys a measurable quality improvement that may reduce support tickets or missed search results. Teams should calculate the cost of a single failed retrieval in their specific domain—if a missed document costs $0.50 in support labor, the breakeven on quality comes at roughly 4,400 improved retrievals per year.

### Dimension Reduction and Storage Economics

Cohere’s Matryoshka embeddings allow dimension selection at query time with no additional API calls. A single embedding request returns a 1024-dimensional vector, and the developer truncates to the desired length. The November 2023 technical report provides exact recall numbers: at 512 dimensions, retrieval recall on BEIR is 98.2% of the full 1024-dimensional recall. At 256 dimensions, it is 96.8%. At 128 dimensions, it drops to 93.5%. These numbers mean that a hybrid architecture—storing 256d vectors for fast approximate search and keeping 1024d vectors on disk for reranking—can achieve full recall while cutting in-memory index size by 75%. Qdrant and Weaviate both support this pattern natively as of their Q2 2024 releases.

## Comparison with OpenAI, Voyage, and BGE Models

The embedding model market moved rapidly through early 2024. In January 2024, OpenAI released text-embedding-3-large (MTEB 64.6, per OpenAI’s January 25, 2024 blog post) and text-embedding-3-small (MTEB 62.3). Voyage AI’s voyage-2 scored 62.8 on MTEB as of March 2024. BAAI’s bge-m3, released February 2024, reached 64.2 on the English MTEB leaderboard. As of September 2024, the MTEB leaderboard top-5 for English models stands at:

1. NV-Embed-v2 (NVIDIA, August 2024): 66.1
2. text-embedding-3-large (OpenAI, January 2024): 64.6
3. bge-m3 (BAAI, February 2024): 64.2
4. Cohere Embed v3 (November 2023): 64.0
5. voyage-2 (Voyage AI, March 2024): 62.8

Embed v3 has been overtaken by newer entrants, but the 64.0 score remains competitive, and the model’s Matryoshka dimension flexibility is not matched by text-embedding-3-large, which requires separate API calls for different dimension sizes. NV-Embed-v2 is open-weight under a non-commercial license, making it suitable for self-hosting but not for teams that need a managed API.

### Self-Hosted vs API Trade-offs

bge-m3 can be self-hosted on an A10G GPU (24 GB VRAM) for approximately $0.75 per hour on AWS, embedding roughly 8,000 tokens per second. At that throughput, embedding 20 billion tokens costs approximately $520 in compute, compared to $2,000 via Cohere’s API. The self-hosted path eliminates per-token costs but adds DevOps overhead: model updates, GPU availability, and scaling logic. For teams under 10 people, the API premium often pays for itself in reduced engineering time. Cohere’s November 2023 launch also included a commitment to model stability—Embed v3 has not received a breaking update since release, which matters for teams that cannot afford embedding drift in production vector databases.

## What to Do Next

Embedding model selection in September 2024 is a three-variable optimization: quality (MTEB score), cost (tokens plus storage), and operational complexity (API vs self-hosted). Cohere Embed v3 occupies a specific point in that space that suits certain workloads.

First, benchmark on your own data. The MTEB leaderboard is a useful filter but does not predict domain-specific retrieval quality. Run a 1,000-query evaluation on your own corpus against Embed v3, text-embedding-3-large, and bge-m3. A half-day of evaluation engineering can surface a 5-point recall delta that the aggregate leaderboard obscures.

Second, exploit dimension flexibility if you choose Embed v3. Store 256d vectors in your primary index and keep 1024d vectors in cold storage for reranking. The storage savings are real—$7,128 per year at 50-million-chunk scale—and the recall trade-off is quantifiable at 1.2 points.

Third, lock in model versioning. Embed v3’s stability since November 2023 is an asset. If you build a RAG pipeline on this model, pin the API version and avoid silent embedding drift. Cohere’s API supports version pinning via the `model` parameter.

Fourth, calculate total cost including reranking. If you use a cross-encoder reranker like Cohere Rerank v3 (priced at $2.00 per 1,000 search requests), a retrieval model that returns the correct document in position 5 instead of position 15 saves 10 reranking calls per query. At 100,000 queries per day, that is $200 per day in reranking savings, or $73,000 per year. The retrieval quality premium pays for itself in downstream processing.
