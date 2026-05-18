---
title: "Cohere Rerank 3 vs BGE Reranker v2 for Enterprise Search"
description: "The enterprise search market has shifted. For two years, the default retrieval stack paired a dense embeddings model with a vector database, then called it d…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:49:16Z"
modDatetime: "2026-05-18T08:49:16Z"
readingTime: 9
tags: ["Model APIs"]
---

The enterprise search market has shifted. For two years, the default retrieval stack paired a dense embeddings model with a vector database, then called it done. That stack works for basic semantic matching but breaks down when queries get long, domain-specific, or require precise lexical overlap. The fix that emerged in late 2023 was a second-stage reranker: a model that takes the top-100 or top-200 candidates from vector search and rescore them for relevance, trading a small latency budget for a large quality gain.

What makes the comparison urgent now is pricing and architecture. Cohere released Rerank 3 in April 2024, dropping the per-search-unit cost by roughly 40% versus Rerank 2 while adding multilingual support across 100+ languages. BGE Reranker v2, from the Beijing Academy of Artificial Intelligence (BAAI), shipped its v2-M3 variant in March 2024 under an MIT license, meaning zero inference cost beyond self-hosting infrastructure. For a team running 10 million queries per month, the difference between a managed API at $0.002 per search and a self-hosted model on a single A10G instance is not marginal; it determines whether the rerank stage exists at all.

The decision is not purely financial. Latency budgets, language coverage, fine-tuning surface, and integration with existing vector stores all weigh on the choice. This article evaluates Cohere Rerank 3 (specifically `rerank-english-v3.0` and `rerank-multilingual-v3.0`) against BGE Reranker v2 (specifically `bge-reranker-v2-m3`) across benchmarks, pricing, deployment patterns, and production behavior as of October 2024.

## Model Architecture and Capability Surface

### Cohere Rerank 3: Managed, Multilingual, and Opaque

Cohere has not released weights, training data composition, or a detailed architecture paper for Rerank 3. What is known from their April 2024 documentation: the model accepts a query and a list of up to 1,000 documents, returning relevance scores normalized to a [0, 1] range. The English variant (`rerank-english-v3.0`) and multilingual variant (`rerank-multilingual-v3.0`) share the same underlying architecture but differ in training data distribution. The multilingual model covers 100+ languages, with strong performance reported on Arabic, Japanese, Korean, and the Romance languages.

The API is stateless. No fine-tuning is available as of October 2024. The model cannot be downloaded or run on-premises. Rate limits on the production tier cap at 10,000 requests per minute, with an enterprise tier available for higher throughput.

### BGE Reranker v2: Open Weights, Cross-Encoder Design

BGE Reranker v2-M3 is a cross-encoder based on the XLM-RoBERTa architecture, released by BAAI on Hugging Face in March 2024. It accepts a (query, document) pair and outputs a single logit converted to a relevance score via sigmoid. The model contains 568 million parameters and requires roughly 2.3 GB of VRAM in float16, making it deployable on a single T4 or A10G GPU.

Because the model is a cross-encoder, it processes each query-document pair independently. This means scoring 100 candidates requires 100 forward passes. For latency-sensitive applications, this is the central bottleneck. The v2-M3 variant is explicitly multilingual, trained on a mix of English, Chinese, Japanese, Korean, and 20+ other languages, with the training data drawn from the MIRACL and Mr. TyDi collections.

The open-weight license (MIT) permits commercial use, modification, and redistribution. Fine-tuning is possible using standard Hugging Face training pipelines, and several community fine-tunes targeting legal, medical, and code-search domains appeared on the Hub between June and September 2024.

## Benchmark Performance on Standard Retrieval Tasks

### BEIR and MTEB Reranking Scores

The BEIR benchmark, despite being released in 2021, remains the most widely cited retrieval evaluation suite. Cohere published BEIR scores for Rerank 3 in their April 2024 launch post, showing the English variant achieving an nDCG@10 of 0.602 on the BEIR reranking subset when paired with a dense retriever. BAAI's technical report for BGE Reranker v2-M3, dated March 15, 2024, reports an nDCG@10 of 0.587 on the same BEIR reranking tasks.

The 0.015 nDCG gap is small but consistent across most BEIR datasets. On NFCorpus (biomedical), the gap widens to 0.023 in Cohere's favor. On SciFact (scientific claim verification), the two models are within 0.008 of each other. Neither vendor has published statistical significance tests for these differences.

On the MTEB (Massive Text Embedding Benchmark) reranking track, updated in January 2024, Cohere Rerank 3-English scores a mean nDCG@10 of 0.614 across all English subsets. BGE Reranker v2-M3 scores 0.598. The multilingual comparison is harder to assess because MTEB's multilingual coverage remains sparse, but on the MIRACL dev set (18 languages), Rerank 3-Multilingual leads by an average of 0.019 nDCG@10.

### Real-World Query Distributions

Benchmark scores tell only part of the story. A July 2024 evaluation by the RAG benchmarking group at LlamaIndex tested both models on 2,000 real-world enterprise queries drawn from customer support logs, legal document search, and internal wiki retrieval. Their published results show:

- Cohere Rerank 3-English: MRR@10 of 0.781, recall@10 of 0.893
- BGE Reranker v2-M3: MRR@10 of 0.764, recall@10 of 0.881

The 0.017 MRR gap translates to roughly one additional relevant document appearing in the top 3 results per 60 queries. Whether that matters depends on the use case. For a legal research tool where missing one precedent has high cost, the gap is material. For a product search bar where the top result is usually clicked, it may be imperceptible.

## Pricing, Latency, and Total Cost of Ownership

### Cohere Rerank 3 Pricing as of October 2024

Cohere charges per search unit, defined as one query plus up to 100 documents. As of October 2024, Rerank 3-English costs $0.002 per search unit on the pay-as-you-go plan. The multilingual variant costs $0.003 per search unit. Volume discounts kick in at 1 million searches per month, dropping to approximately $0.0015 and $0.0022 respectively under an annual commitment.

For a mid-scale deployment processing 5 million queries per month with an average of 80 candidates per query, the monthly cost is:

- English: 5M × $0.002 = $10,000 per month
- Multilingual: 5M × $0.003 = $15,000 per month

Latency from Cohere's API averages 120 milliseconds for a batch of 100 documents, measured from us-east-1 in October 2024. This includes network round-trip time. Under heavy load, p99 latency can spike to 350 milliseconds.

### BGE Reranker v2 Self-Hosted Costs

Self-hosting BGE Reranker v2-M3 on AWS incurs infrastructure costs rather than per-query fees. On a single `g5.xlarge` instance (1× A10G GPU, 24 GB VRAM) with on-demand pricing of $1.006 per hour as of October 2024, the model can process approximately 80 query-document pairs per second when batched. This translates to roughly 2,880 queries per hour at 100 candidates per query, or about 2.07 million queries per month on a single instance.

Monthly infrastructure cost: $1.006 × 730 hours = $734.38. Adding a load balancer and a second instance for redundancy brings the total to approximately $1,500–$1,800 per month. At 5 million queries per month, three instances are needed, bringing the monthly cost to roughly $2,200–$2,600 including networking and orchestration overhead.

The cost differential is stark: roughly $10,000 per month for Cohere versus $2,500 for self-hosted BGE at 5 million query volume. The gap widens linearly with volume.

Latency for self-hosted BGE Reranker v2-M3 on an A10G averages 85 milliseconds for a batch of 100 documents (inference only, no network overhead). With a FastAPI wrapper and gRPC transport, end-to-end latency from a client in the same AWS region hovers around 95–110 milliseconds.

### Cold Start and Scaling Considerations

Cohere's API requires no cold start; the first query returns in standard latency. Self-hosted BGE requires model loading on container startup, which takes 8–12 seconds on an A10G. For auto-scaling deployments, this means either over-provisioning or accepting cold-start latency on scale-out events.

Cohere handles throughput spikes transparently up to the rate limit. Self-hosted deployments need queue management and backpressure handling when query volume exceeds GPU capacity. Teams without MLOps experience often underestimate this operational burden.

## Language Coverage and Domain Adaptation

### Multilingual Quality Across Language Families

Cohere Rerank 3-Multilingual covers 100+ languages, with documented strong performance on Arabic, Japanese, Korean, French, Spanish, and German. BGE Reranker v2-M3 covers roughly 25 languages, with training data concentrated on English, Chinese, Japanese, and Korean.

In a September 2024 evaluation by the multilingual retrieval group at Cohere-for-AI (published on arXiv), Rerank 3-Multilingual achieved an average nDCG@10 of 0.591 across 18 MIRACL languages. BGE Reranker v2-M3 scored 0.572 on the same set. The gap is largest for Arabic (0.041 nDCG difference) and smallest for French (0.006 difference).

For teams operating in languages outside BGE's core set of 25, Cohere is the only viable option without additional fine-tuning.

### Fine-Tuning Surface

BGE Reranker v2-M3 can be fine-tuned on domain-specific relevance data using standard sentence-transformers or Hugging Face Trainer pipelines. A team with 5,000 labeled query-document pairs and a single A10G can produce a domain-adapted reranker in under 3 hours. Several production teams have reported nDCG improvements of 0.04–0.07 on in-domain retrieval after fine-tuning with as few as 2,000 examples.

Cohere Rerank 3 offers no fine-tuning API as of October 2024. The model must be used as-is. For domains with specialized vocabulary (patent law, medical literature, proprietary codebases), this is a binding constraint. A pharmaceutical company searching internal research documents will likely see better results from a fine-tuned BGE model than from a general-purpose Cohere endpoint, regardless of benchmark scores on public datasets.

## Integration Patterns and Ecosystem Fit

### Vector Database Compatibility

Both models integrate with the major vector databases through their respective reranking interfaces. As of October 2024:

- **Pinecone**: Native Cohere rerank integration via `pinecone inference`. BGE requires custom middleware.
- **Weaviate**: Native Cohere module. BGE support via `reranker-transformers` module since v1.24 (June 2024).
- **Qdrant**: No native reranker integration for either. Both require external scoring and re-ranking logic.
- **Milvus**: No native reranker integration. External scoring required.
- **Elasticsearch**: Cohere available via inference API since 8.13 (March 2024). BGE requires custom model deployment.

Teams on Pinecone or Weaviate will find Cohere's integration smoother, with fewer moving parts. Teams on Qdrant, Milvus, or Elasticsearch face similar integration effort for both models, tilting the decision toward cost and performance considerations.

### Framework Support

In the LLM framework ecosystem, LangChain and LlamaIndex both ship with Cohere reranker classes. BGE reranker support is available through Hugging Face cross-encoder wrappers but requires more boilerplate. LlamaIndex's `CohereRerank` class handles batching and retry logic out of the box. The equivalent `HuggingFaceCrossEncoder` class for BGE requires manual batch size tuning and does not retry on transient GPU out-of-memory errors.

For teams building custom retrieval pipelines without a framework, both models expose straightforward APIs: Cohere via REST, BGE via a Python callable. The integration difference is measured in hours, not days.

## Closing Takeaways

The choice between Cohere Rerank 3 and BGE Reranker v2-M3 hinges on four variables: query volume, language requirements, domain specificity, and operational capacity.

First, calculate the cost crossover point. At $0.002 per search unit, Cohere becomes more expensive than self-hosting BGE on a single GPU at approximately 370,000 queries per month. Below that volume, the managed API's simplicity outweighs the cost difference. Above 1 million queries per month, self-hosting BGE saves $7,000–$8,000 monthly, which funds a dedicated MLOps engineer.

Second, if the application serves queries in languages outside BGE's 25-language core set, Cohere's multilingual variant is the default choice. The 0.019 nDCG gap on MIRACL is large enough to be user-visible, particularly for Arabic and East Asian languages.

Third, if the retrieval domain is specialized and the team has access to 2,000+ labeled query-document pairs, fine-tuned BGE will likely outperform Cohere's general-purpose endpoint. The open-weight model's adaptability is its strongest differentiator.

Fourth, for teams without GPU infrastructure or MLOps expertise, Cohere's API eliminates operational risk. The 120-millisecond latency is predictable, there is no cold start, and rate limits are generous enough for most production workloads. The premium paid is for reliability, not just relevance scores.

Neither model is universally superior. The evaluation must start with the specific query distribution, volume, and language profile of the production workload, not with benchmark leaderboards.
