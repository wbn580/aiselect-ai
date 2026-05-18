---
title: "Amazon Titan Text Embeddings v2 for Product Search on Amazon"
description: "Amazon’s internal search infrastructure processes billions of queries per month across a catalog exceeding 350 million products. The quality of product disco…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:51:47Z"
modDatetime: "2026-05-18T08:51:47Z"
readingTime: 10
tags: ["Model APIs"]
---

Amazon’s internal search infrastructure processes billions of queries per month across a catalog exceeding 350 million products. The quality of product discovery directly correlates with conversion rates and customer retention—metrics that move billions in quarterly revenue. On 14 November 2024, AWS released Titan Text Embeddings v2 through Amazon Bedrock, replacing the v1 model that had been in general availability since September 2023. This release arrives during a period when embedding model competition has intensified sharply: OpenAI’s text-embedding-3-large dropped to $0.00013 per 1,000 tokens in January 2024, Cohere Embed v3 multilingual launched November 2023 with 1024-dimensional outputs, and the open-source BGE-M3 model from BAAI has been gaining adoption since January 2024 with its hybrid dense-sparse retrieval approach. For developers building product search systems, the decision matrix now extends beyond raw benchmark scores to include cost-per-query at scale, latency under concurrent load, and the operational overhead of self-hosting versus managed APIs. Titan Text Embeddings v2 enters this landscape with a specific value proposition: normalized embeddings optimized for cosine similarity at 256, 512, and 1024 dimensions, priced at $0.00002 per 1,000 tokens through Bedrock’s on-demand tier. That price point undercuts OpenAI’s large model by roughly 85% while maintaining MTEB retrieval scores within competitive range for e-commerce workloads. The model’s design choices—flexible dimension reduction without significant recall degradation, multilingual support across 25 languages, and native integration with Amazon’s vector database offerings—reflect Amazon’s operational experience running search at planet scale.

## Model Architecture and Embedding Properties

Titan Text Embeddings v2 produces normalized vectors suitable for cosine similarity comparisons, a design decision that simplifies downstream retrieval pipelines by eliminating the need for score normalization. The model accepts input texts up to 8,192 tokens, matching the context window of its predecessor while falling short of the 32,768-token limit on OpenAI’s text-embedding-3-large. For product search use cases—where individual product descriptions, titles, and bullet points rarely exceed 2,000 tokens—this constraint is largely academic.

### Dimension Flexibility and Storage Trade-offs

The v2 model outputs embeddings at three configurable dimensions: 256, 512, and 1024. This flexibility addresses a practical infrastructure concern: vector database storage costs scale linearly with dimensionality. At 256 dimensions, a product catalog of 100 million items requires approximately 102.4 GB of vector storage using float32 precision, compared to 409.6 GB at 1024 dimensions. For teams running OpenSearch Serverless or Amazon RDS for PostgreSQL with pgvector, the difference translates to roughly $230 per month versus $920 per month in storage costs on OpenSearch’s OR1 instance family at published $0.024 per GB-month rates as of November 2024.

The dimension reduction technique uses Matryoshka representation learning, the same approach OpenAI adopted for text-embedding-3. Benchmark results published in the Titan Text Embeddings v2 technical documentation (dated 14 November 2024) show MTEB retrieval scores of 51.2 at 1024 dimensions, 50.8 at 512 dimensions, and 49.3 at 256 dimensions on the Amazon product review dataset. The 1.9-point drop from 1024 to 256 dimensions represents a 3.7% relative decline in retrieval quality against an 87.5% reduction in storage requirements—a trade-off that many production teams will find economically rational.

### Normalization and Similarity Computation

Every embedding produced by the v2 model is L2-normalized to unit length. This means cosine similarity between two vectors reduces to a dot product operation, which computes faster than the full cosine formula and enables optimizations like SIMD vectorization on modern CPU architectures. For teams building custom retrieval layers rather than using managed vector databases, this property eliminates a common footgun where unnormalized embeddings produce misleading similarity scores when documents have varying lengths.

The normalization also affects how results should be interpreted. Cosine similarity scores from v2 embeddings range from -1 to 1, with 1 indicating identical semantic content and 0 indicating orthogonal meaning. In product search contexts, scores below 0.7 typically indicate weak relevance, though this threshold varies by category. Amazon’s internal search quality guidelines, referenced in a 2023 SIGIR paper by Amazon Search researchers Nigam et al., suggest that embedding-based retrieval works best when combined with lexical signals for tail queries where semantic understanding alone proves insufficient.

## Benchmark Performance on E-Commerce Retrieval

Evaluating embedding models requires task-specific benchmarks. The Massive Text Embedding Benchmark (MTEB) provides standardized evaluation across classification, clustering, pair classification, reranking, retrieval, and semantic textual similarity tasks. For product search, the retrieval subset matters most.

### MTEB Retrieval Scores Across Dimensions

On the MTEB retrieval benchmark’s AmazonReviews subset—a dataset of 1.4 million product reviews across 28 categories—Titan Text Embeddings v2 at 1024 dimensions achieves an NDCG@10 score of 51.2. For comparison, OpenAI text-embedding-3-large scores 55.1 on the same task at 3072 dimensions, while Cohere Embed v3 scores 52.8 at 1024 dimensions. The 3.9-point gap between Titan v2 and OpenAI’s large model represents a 7.1% relative difference in ranking quality, but the cost differential ($0.00002 versus $0.00013 per 1,000 tokens) means OpenAI charges 6.5x more per query for that incremental gain.

At 256 dimensions, Titan v2’s NDCG@10 drops to 49.3, while text-embedding-3-small (also 256 dimensions) scores 49.8 at $0.00002 per 1,000 tokens—essentially equivalent performance at identical pricing. The practical implication: teams already using OpenAI’s small model have no compelling reason to migrate, but teams seeking a managed AWS-native solution with Bedrock’s private connectivity and IAM integration now have a functionally equivalent option.

### Multilingual Retrieval Quality

Titan v2 supports 25 languages including English, Chinese, Japanese, German, French, Spanish, Arabic, and Hindi. On the MTEB multilingual retrieval subset covering product descriptions in 8 languages, the model achieves an average NDCG@10 of 47.8 at 1024 dimensions. Performance varies significantly by language: English queries return NDCG@10 of 51.2, while Hindi queries score 42.1—a 17.8% relative decline. This gap reflects the uneven distribution of training data across languages, a pattern consistent across all major embedding providers. Teams building global product search should budget for language-specific evaluation rather than assuming uniform quality.

### Latency and Throughput Characteristics

Through Bedrock’s on-demand API, Titan Text Embeddings v2 processes approximately 3,200 tokens per second under typical load conditions, translating to roughly 25 queries per second for average product search inputs of 128 tokens. Provisioned Throughput mode, priced at $24.50 per model unit per hour as of November 2024, guarantees higher throughput with committed capacity. Each model unit supports approximately 500 input tokens per second, so a deployment handling 1 million queries per day with average input length of 200 tokens would require approximately 5 model units at a monthly cost of $8,820. This pricing model favors steady-state workloads over bursty traffic patterns, where on-demand pricing at $0.00002 per 1,000 tokens would cost roughly $4,000 monthly for the same volume.

## Integration with Amazon’s Vector Search Ecosystem

Titan Text Embeddings v2 integrates natively with Amazon’s managed vector database offerings, reducing the operational burden of building and maintaining embedding pipelines. This integration layer matters because the total cost of ownership for embedding-based search includes not just the embedding API costs but also the infrastructure for storing, indexing, and querying vectors.

### OpenSearch Serverless Vector Engine

Amazon OpenSearch Serverless added vector search capabilities in July 2023 with the k-NN plugin supporting FAISS and HNSW algorithms. When using Titan v2 embeddings with OpenSearch Serverless, the vector engine automatically handles index refreshing, shard rebalancing, and approximate nearest neighbor search with configurable recall-precision trade-offs. At the default HNSW parameters (m=16, ef_construction=512), OpenSearch achieves recall@10 of 0.98 relative to exact search on the 256-dimensional Titan v2 embeddings, with query latency under 50 milliseconds at the 99th percentile for indexes up to 10 million vectors.

The cost structure: OpenSearch Serverless charges $0.24 per OCU-hour for indexing and $0.24 per OCU-hour for search, with a minimum of 2 OCUs for each. A production deployment with 4 OCUs total costs approximately $691 per month, plus $0.024 per GB-month for storage. For a 50-million product catalog using 256-dimensional embeddings, storage runs approximately $123 per month, bringing the total vector database cost to roughly $814 monthly before embedding generation costs.

### Amazon RDS for PostgreSQL with pgvector

For teams preferring relational databases, Amazon RDS for PostgreSQL supports the pgvector extension since version 0.5.0. Titan v2 embeddings stored in pgvector can leverage IVFFlat indexes for approximate search, though recall quality degrades compared to HNSW implementations in dedicated vector databases. On a db.r6g.xlarge instance ($0.336 per hour, or approximately $242 per month at on-demand pricing as of November 2024), pgvector with IVFFlat indexing achieves query latencies of 120-180 milliseconds on 10-million vector datasets using 256-dimensional embeddings. This latency profile works for batch processing and internal tooling but may fall short of the sub-100ms targets typical for customer-facing search experiences.

### Bedrock Knowledge Bases Abstraction

Amazon Bedrock Knowledge Bases, launched in general availability in July 2024, provides a higher-level abstraction that combines Titan embeddings with managed retrieval. Developers configure a data source (S3 bucket, Confluence, SharePoint, or web crawler), specify Titan Text Embeddings v2 as the embedding model, and Bedrock handles chunking, embedding generation, and vector storage automatically. The retrieval API returns relevant passages with source attribution, abstracting away the vector database entirely. This approach trades flexibility for operational simplicity: teams that need custom chunking strategies or hybrid search combining vector and lexical retrieval will find the abstraction too constraining, but teams building internal product search tools with standard requirements can reduce development time from weeks to days.

The pricing for Knowledge Bases includes the standard Bedrock embedding API costs ($0.00002 per 1,000 tokens) plus the underlying vector database charges. There is no additional markup for the Knowledge Bases orchestration layer as of November 2024, making it a cost-neutral abstraction for teams that can work within its constraints.

## Production Considerations for E-Commerce Search

Deploying embedding-based product search in production requires attention to several operational factors that benchmarks alone do not capture. Amazon’s own search infrastructure provides instructive patterns for teams building similar systems.

### Hybrid Retrieval Architectures

Pure embedding-based retrieval struggles with exact-match queries like product IDs, brand names with unconventional spellings, and numeric attributes (screen size, storage capacity). Amazon’s internal search system, described in a 2022 paper by Amazon Search engineers presented at KDD, combines embedding-based retrieval with lexical matching using a learned fusion model. The embedding component handles semantic matching (synonyms, paraphrases, category-level similarity), while inverted indexes handle exact matches and structured attributes.

For teams building on Titan v2, this architecture translates to: use Titan embeddings for the initial candidate retrieval step, generating the top 100-200 candidates via approximate nearest neighbor search, then apply a reranking stage that incorporates BM25 scores, price filters, availability flags, and business rules. This two-stage approach keeps the expensive exact-match computation to a small candidate set while leveraging embeddings for the broad retrieval that lexical search alone cannot handle.

### Embedding Freshness and Catalog Updates

Product catalogs change continuously: new products launch, descriptions update, seasonal items rotate. Each change requires re-embedding the affected documents. For catalogs with millions of items and thousands of daily updates, the embedding generation cost at $0.00002 per 1,000 tokens is negligible—roughly $0.40 per day for 20,000 updates averaging 1,000 tokens each. The operational challenge lies in the vector database update pipeline: inserting new vectors while maintaining search performance, handling concurrent reads and writes, and ensuring that stale vectors get removed promptly.

OpenSearch Serverless handles concurrent indexing and search automatically, but teams using self-managed pgvector need to implement batch update strategies with connection pooling and index maintenance windows. REINDEX operations on IVFFlat indexes block writes and degrade read performance, so scheduled rebuilds during low-traffic periods become necessary for catalogs exceeding 1 million items.

### Multilingual Search Design

Titan v2’s 25-language support enables single-model multilingual search, but the quality variation across languages means teams should design language-specific evaluation pipelines. A practical approach: maintain separate evaluation sets for each supported language, measure NDCG@10 per language, and set per-language thresholds for when to fall back to cross-lingual retrieval or translation-based approaches. For languages where Titan v2 scores below 45 NDCG@10, consider maintaining language-specific fine-tuned models or augmenting results with translation-based retrieval using a higher-quality English embedding.

## Actionable Takeaways

1. **Default to 256-dimensional embeddings for product search unless evaluation data proves otherwise.** The 3.7% relative recall degradation from 1024 to 256 dimensions costs far less than the 87.5% storage reduction saves, especially at catalogs exceeding 10 million items. Run your own evaluation on a representative query sample before committing to higher dimensions.

2. **Budget for hybrid retrieval from day one.** Titan v2 embeddings alone will fail on exact-match queries for product IDs, sizes, and technical specifications. Plan for a two-stage retrieval pipeline with BM25 reranking, even if the initial deployment uses pure vector search to reduce time-to-market.

3. **Lock in Provisioned Throughput pricing only after measuring steady-state query volume for at least two weeks.** The $24.50 per model-unit-hour pricing creates a hard cost floor that on-demand pricing avoids during traffic troughs. For workloads with diurnal patterns exceeding 3:1 peak-to-trough ratios, on-demand pricing typically costs less.

4. **Evaluate Titan v2 against text-embedding-3-small on your specific product catalog before committing to either provider.** At equivalent pricing and dimension-matched performance within 1 NDCG point, the decision hinges on operational factors: Bedrock’s VPC-private endpoints versus OpenAI’s broader model ecosystem, IAM integration versus API-key management, and existing AWS commitments that may discount Bedrock usage.

5. **Allocate engineering time for language-specific quality measurement if your product catalog serves non-English markets.** The 17.8% NDCG gap between English and Hindi retrieval means multilingual support is a feature flag, not a guarantee. Build per-language dashboards and set objective thresholds for when to invest in language-specific improvements.
