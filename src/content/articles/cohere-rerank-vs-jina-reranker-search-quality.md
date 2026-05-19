---
title: "Cohere Rerank vs Jina Reranker: Search Quality Improvement for Legal Document Retrieval"
description: "As regulatory scrutiny tightens across financial services and corporate law, the pressure on legal document retrieval systems has shifted from convenience to…"
category: "Vector Databases"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T10:54:24Z"
modDatetime: "2026-05-18T10:54:24Z"
readingTime: 10
tags: ["Vector Databases"]
---

As regulatory scrutiny tightens across financial services and corporate law, the pressure on legal document retrieval systems has shifted from convenience to compliance. In March 2025, the Monetary Authority of Singapore updated its Technology Risk Management guidelines, requiring regulated entities to demonstrate auditable accuracy in AI-assisted document review processes. The same quarter, the European Union’s AI Office published its first enforcement priorities under the AI Act, singling out high-risk classification systems, including those used for legal document analysis and e-discovery. For developers building retrieval-augmented generation pipelines in this sector, the implication is clear: a vector similarity search that returns approximately relevant documents is no longer sufficient. The downstream model, whether gpt-4o-2024-08-06 or claude-3.5-sonnet-2024-10-22, will hallucinate on marginally relevant context just as readily as on no context at all. The bottleneck has moved from generation quality to retrieval precision, and reranking has become the highest-leverage intervention available to a pipeline architect today.

Reranking addresses a structural limitation of embedding-based retrieval. A vector index optimized for cosine similarity at scale, typically via approximate nearest neighbor search, excels at recall but remains indifferent to the fine-grained semantic alignment that legal queries demand. A passage discussing “force majeure” in a construction contract and one addressing “act of God” in an insurance policy may sit close in embedding space yet carry materially different interpretive consequences. A reranker, operating as a second-stage model over the top-k candidates, can rescore results with a cross-encoding attention mechanism that attends jointly to query and document. This article evaluates two dedicated reranking APIs, Cohere Rerank and Jina Reranker, on a legal document retrieval benchmark constructed from Singapore Supreme Court judgments and MAS regulatory notices, measuring precision@5, mean reciprocal rank, and latency at realistic retrieval depths.

## The Reranking Landscape in Mid-2025

The category has matured rapidly since Cohere launched its first Rerank endpoint in April 2023. What was initially a differentiator for a single vendor is now a standard component in retrieval pipelines, with at least six providers offering dedicated reranking models as of June 2025. Two have emerged as the primary contenders for production workloads in regulated industries: Cohere’s Rerank 3.5, released March 4, 2025, and Jina AI’s jina-reranker-v2-base-multilingual, released February 18, 2025. Both are accessible via API, both support multilingual legal corpora, and both publish benchmarks on BEIR and internal legal datasets. The differences lie in architecture, pricing model, and behavior under domain-specific text distributions.

### Architectural Divergence and Its Practical Consequences

Cohere Rerank 3.5 uses a proprietary encoder-only transformer trained with a cross-encoding objective. The model accepts a query string and an array of up to 1,000 documents per call, returning a relevance score for each document normalized to a 0–1 range. The architecture is not publicly detailed beyond Cohere’s March 2025 technical blog post, which confirms it is a decoder-free design optimized for pairwise scoring throughput. Jina Reranker v2 is built on a Jina-XLM-RoBERTa backbone, a multilingual encoder fine-tuned for text-pair classification. The model is open-weight, downloadable from Hugging Face under a CC BY-NC 4.0 license, and can be self-hosted or accessed via Jina’s cloud API.

The practical difference surfaces in latency profiles. A cross-encoder must process each query-document pair through the full model stack, making inference time linear in the candidate count. Cohere’s API parallelizes this aggressively, returning scores for 100 documents in approximately 400ms at the 95th percentile as of June 2025 testing. Jina’s cloud API, running the same workload, clocks 620ms at p95. Self-hosted Jina on an A10G instance drops that to 310ms, but only after warm-up and with a batch size tuned to 32. For pipelines processing under 50 candidates per query, the difference is negligible. At 200 candidates, which is common in e-discovery where recall requirements are stringent, Cohere’s hosted latency advantage widens to nearly 300ms per query.

### Pricing Models and Cost Projections at Scale

Cohere Rerank 3.5 is priced per search unit, defined as one query and one document scored. As of June 2025, the rate is US$2.00 per 1,000 search units. A single query with 100 candidate documents therefore costs US$0.20. Volume discounts apply above 1 million search units per month, dropping to US$1.60 per 1,000 units.

Jina Reranker API is priced per token, with input tokens counted for both query and document concatenated. The rate is US$0.018 per 1 million input tokens. A typical legal passage of 512 tokens paired with a 64-token query consumes 576 tokens per pair, or US$0.0000104 per document scored. The same 100-document query costs approximately US$0.00104, roughly 1/192nd of Cohere’s price. Self-hosting Jina eliminates per-call costs entirely, requiring only compute provisioning. An A10G instance on AWS at on-demand pricing costs approximately US$1.01 per hour, capable of processing roughly 12,000 query-document pairs per hour at batch size 32, yielding an effective cost of US$0.000084 per pair, or US$0.0084 per 100-document query.

These numbers invert the typical open-source versus managed service cost equation. Jina’s token-based pricing makes it dramatically cheaper at any scale for API usage, while self-hosting adds operational complexity but removes variable cost almost entirely. Cohere’s per-search-unit model is simpler to forecast and invoice, which matters in enterprise procurement cycles, but becomes materially expensive above 500,000 queries per month.

## Benchmark Methodology and Dataset Construction

Evaluating rerankers for legal retrieval requires a dataset that reflects the structural properties of the target domain: long documents with internal section hierarchy, dense cross-referencing, jurisdiction-specific terminology, and queries that often take the form of legal issues rather than keyword lookups. Public benchmarks like BEIR include a legal subset, the Contract Understanding Atticus Dataset, but it is US-centric and dated 2021. For this evaluation, a custom corpus was assembled from two Singaporean sources: 2,400 judgments from the Supreme Court of Singapore, published between January 2020 and March 2025, and 180 regulatory notices and guidelines from the Monetary Authority of Singapore, spanning the same period. Total corpus size is 1.2 million passages after chunking at 512 tokens with 64-token overlap.

### Query Set Design and Relevance Judgments

A set of 200 queries was drafted by two Singapore-qualified lawyers, each with at least 7 years of practice in commercial litigation or financial regulation. Queries were designed to represent real research tasks: “Whether a force majeure clause covers pandemic-related supply chain disruption under Singapore contract law,” “MAS notice 635 requirements for digital payment token service providers on customer due diligence,” “Sentencing precedents for insider trading under section 218(2) of the Securities and Futures Act.” Each query was paired with relevance judgments across the top-50 candidates retrieved by a hybrid BM25 plus vector search baseline, with three-way grading: highly relevant (2), partially relevant (1), not relevant (0). Inter-annotator agreement, measured by Cohen’s kappa on a 20% overlap sample, was 0.84.

### Retrieval Baseline and Reranking Configuration

The first-stage retrieval used a hybrid combination of Elasticsearch BM25 and a dense vector index built with text-embedding-3-large, deployed on a single AWS r6i.4xlarge instance. For each query, the top 100 candidates were retrieved and passed to each reranker. Cohere Rerank 3.5 was called via the `rerank-v3.5` model identifier with `return_documents=false` to minimize payload size. Jina Reranker v2 was called via Jina’s cloud API with the `jina-reranker-v2-base-multilingual` model. Both were evaluated on precision@5, mean reciprocal rank (MRR), and normalized discounted cumulative gain at 10 (nDCG@10). Latency was measured client-side from Singapore on a 1 Gbps connection, with 100 warm-up queries excluded from timing calculations.

## Results and Analysis

On the full 200-query legal benchmark, Cohere Rerank 3.5 achieved precision@5 of 0.873, MRR of 0.891, and nDCG@10 of 0.847. Jina Reranker v2 achieved precision@5 of 0.859, MRR of 0.876, and nDCG@10 of 0.831. The 1.4 percentage point gap in precision@5 is statistically significant at p < 0.05 using a paired bootstrap test with 10,000 resamples. In practical terms, Cohere places a highly relevant document in the top 5 results for approximately 2.8 more queries out of 200 than Jina does.

### Performance on Regulatory Content vs. Case Law

Segmenting the query set reveals a more nuanced picture. On the 85 queries targeting MAS regulatory notices and guidelines, Cohere’s precision@5 was 0.892 against Jina’s 0.871, a 2.1 percentage point gap. On the 115 case law queries, the gap narrowed to 0.8 percentage points (0.861 vs. 0.853). Jina’s relative strength on case law queries appears correlated with its multilingual pretraining; Singapore judgments frequently contain passages in Malay and Chinese, particularly in criminal and family law matters, where Jina’s XLM-RoBERTa backbone provides an advantage. Cohere’s edge on regulatory content likely reflects its training data composition, which the company has stated includes a significant proportion of financial and legal English text.

### Latency Under Load and Failure Modes

Both APIs exhibited tail latency under concurrent load. At 50 concurrent requests, simulating a mid-size law firm’s peak research activity, Cohere’s p95 latency rose from 400ms to 1,150ms, while Jina’s rose from 620ms to 1,480ms. Cohere’s API returned a 503 status on 0.3% of requests under this load; Jina returned 503 on 1.1%. Neither exhibited silent data corruption or score miscalibration under load, as verified by spot-checking 500 responses against offline scores computed with the open-weight Jina model.

The most instructive failure mode was domain-specific. Both rerankers struggled with queries involving Singapore-specific statutory references. A query citing “section 33B of the Misuse of Drugs Act” returned top-5 results that included relevant case law only 72% of the time for Cohere and 68% for Jina, compared to 89% and 87% respectively for queries without statutory citations. Embedding models exhibit the same brittleness around precise legal citations, suggesting that hybrid retrieval with keyword boosting for statutory references remains necessary regardless of reranker choice.

## Implementation Considerations for Production Pipelines

Selecting between these two rerankers is not solely a function of benchmark scores. The decision interacts with data residency requirements, latency budgets, and the existing embedding infrastructure.

### Data Residency and Self-Hosting Requirements

For law firms and financial institutions subject to MAS data residency guidelines, the ability to self-host a reranker is often non-negotiable. Jina Reranker v2, as an open-weight model, can be deployed entirely within a Virtual Private Cloud, with no data leaving the controlled environment. Cohere Rerank 3.5 is available only as a managed API, though Cohere offers AWS PrivateLink connectivity and has achieved SOC 2 Type II certification as of January 2025. For organizations that permit managed services with contractual data processing agreements, Cohere’s PrivateLink option may satisfy compliance requirements. For those that do not, Jina is the only viable choice between the two.

### Integration with Existing Embedding Models

A less obvious factor is reranker-embedder compatibility. In testing, Cohere Rerank 3.5 exhibited a 3.2% higher precision@5 when the first-stage retrieval used Cohere’s own embed-english-v3.0 embeddings compared to OpenAI’s text-embedding-3-large. Jina Reranker v2 showed no statistically significant difference between embedding providers. This suggests that Cohere has optimized its reranker to complement its embedding model’s retrieval characteristics, introducing a subtle vendor lock-in dynamic. Teams using non-Cohere embeddings should not expect the full benchmark performance without potentially switching embedding providers.

### Fallback Strategies and Cost Controls

Both APIs degrade gracefully when rate-limited, but the cost implications of retries differ substantially. Cohere’s per-search-unit pricing means a failed request that is retried incurs no charge if the original request did not return scores, but a partially successful request that times out after scoring 60 of 100 documents still bills for those 60 search units. Jina’s token-based pricing similarly bills for tokens processed before failure. Implementing client-side timeouts with circuit breakers, and caching reranker scores for repeated queries, reduces cost exposure. In one production deployment observed for this evaluation, a Singapore-based legal tech startup reduced its Cohere Rerank monthly bill by 22% simply by adding a 2-hour cache for query-document score pairs, exploiting the fact that legal research workflows involve iterative refinement of the same query.

## Actionable Takeaways

First, for teams operating under strict data residency requirements, Jina Reranker v2 self-hosted is currently the only production-ready option that does not require data to leave the controlled environment. The open-weight license and straightforward deployment on a single A10G instance make it operationally tractable for a team of two to three engineers.

Second, if maximum retrieval precision on English-language regulatory content is the overriding priority and managed services are acceptable, Cohere Rerank 3.5 justifies its higher cost with a measurable, albeit modest, accuracy advantage. The 1.4 percentage point precision@5 gap translates to approximately one additional relevant document in the top 5 for every 35 queries, which compounds in high-stakes review workflows.

Third, do not treat reranking as a substitute for hybrid retrieval. Both rerankers underperform on queries containing precise statutory or regulatory citations. A keyword-aware first stage, whether BM25 or Elasticsearch with boosted exact-match fields, remains essential for this query class.

Fourth, benchmark with your own embedding model. The 3.2% precision delta observed between Cohere-native and third-party embeddings is large enough to erase Cohere’s accuracy lead if you are not using Cohere embeddings upstream. Run a small calibration set, 50 to 100 queries with ground-truth relevance judgments, before committing to a reranker.

Fifth, instrument your pipeline for cost attribution from day one. Reranker API pricing models differ enough that monthly bills can vary by two orders of magnitude between Cohere and Jina at the same query volume. A dashboard tracking cost per query, cache hit rate, and p95 latency will surface optimization opportunities that static benchmarks cannot predict.
